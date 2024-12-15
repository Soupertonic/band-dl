#!/usr/bin/env node

import { finished } from "node:stream/promises"
import { mkdirSync, createWriteStream } from "node:fs"

import async from 'async'
import axios from 'axios'
import chalk from 'chalk'
import sanitize from 'sanitize-filename'
import { parse } from 'node-html-parser'

const parameters = process.argv.slice(2)
const silent = Boolean(parseInt(process.env.BDL_SILENT || 0))

const run = async () => {
  const parametersEmpty = parameters.length == 0
  if (parametersEmpty) {
    aborted("No parameters provided")
    process.exit(1)
  }

  const parametersDeclareArtist = parameters.length == 1
  if (parametersDeclareArtist) {
    const artist = parameters[0]
    await processAllAlbums(artist)
  } 

  const parametersDeclareArtistAndAlbums = parameters.length > 1
  if (parametersDeclareArtistAndAlbums) {
    const artist = parameters[0]
    const albums = parameters.slice(1)
    await processSelectedAlbums(artist, albums)
  } 
}

const processAllAlbums = async (artist) => {
  const albums = await fetchAvailableAlbums(artist)
  return processAlbums(artist, albums)
}

const processSelectedAlbums = async (artist, albumIdentifiers) => {
  const albumsAll = await fetchAvailableAlbums(artist)
  const albums = albumsAll.filter(album => albumIdentifiers.includes(album.identifier))

  return processAlbums(artist, albums)
}

const processAlbums = async (artist, albums) => {
  const songs = await async.flatMapLimit(albums, 8, async album => await fetchAvailableSongs(artist, album))
  const _ = await async.eachLimit(songs, 8, async song => await downloadSong(song))
}

const fetchAvailableAlbums = async (artist) => {
  const bandcampUrl = `https://${artist}.bandcamp.com/music`
  const bandcampResponse = await fetch(bandcampUrl).then(v => v.text())
  const bandcampHtml = parse(bandcampResponse)

  let albums = []
  albums.push(tryExtractAlbumsFromDom(bandcampHtml) ?? [])
  albums.push(tryExtractAlbumsFromDataAttribute(bandcampHtml) ?? [])
  albums = albums.flat()

  if (albums === null) {
    aborted(
      "Unable to fetch albums for",
      chalk.yellowBright(artist),
      "(Do they have any albums?)"
    )
    process.exit(2)
  }

  fetched(
    "Available albums for",
    chalk.yellowBright(artist),
    chalk.cyanBright(`[${albums.length}]`),
    chalk.greenBright(`(${albums.map(album => album.title)})`)
  )

  return albums;
}

const fetchAvailableSongs = async (artist, album) => {
  const bandcampUrl = `https://${artist}.bandcamp.com/album/${album.identifier}`
  const bandcampResponse = await axios.get(bandcampUrl)
  const bandcampHtml = parse(bandcampResponse.data)
  
  const artistNameElement = bandcampHtml.querySelector("#band-name-location .title")
  const artistName = artistNameElement.textContent

  const albumDataElement = bandcampHtml.querySelector("script[data-tralbum]")
  const albumData = JSON.parse(albumDataElement.getAttribute("data-tralbum"))

  const songs = albumData.trackinfo.map(song => {
    return {
      artist: artistName,
      album: album.title,
      title: song.title,
      file: song.file["mp3-128"]
    }
  })

  fetched(
    "Available songs for",
    chalk.yellowBright(album.title),
    chalk.greenBright(`(${songs.map(song => song.title)})`)
  )

  return songs
}

const downloadSong = async (song) => {
  const songArtistName = sanitize(song.artist)
  const songAlbumName = sanitize(song.album)
  const songTitle = sanitize(song.title)

  const songDirectory = `${songArtistName}/${songAlbumName}`;
  const songFile = `${songDirectory}/${songTitle}.mp3`;

  mkdirSync(songDirectory, { recursive: true });

  const writeStream = createWriteStream(songFile)
  const response = await axios.get(song.file, { responseType: "stream" });

  await finished(response.data.pipe(writeStream))
  writeStream.close()

  downloaded(song.title, chalk.greenBright(`(${song.album})`))
}

const tryExtractAlbumsFromDataAttribute = (document) => {
  const albumDataElement = document.querySelector("ol[data-client-items]")
  if (albumDataElement === undefined || albumDataElement === null) {
    return null
  } 

  const albumData = JSON.parse(albumDataElement.getAttribute("data-client-items"))
  if (Object.keys(albumData).length == 0) {
    return null
  }

  const albums = albumData.map(album => {
    return {
      title: album.title,
      identifier: album.page_url.split("/").pop(),
    }
  })

  return albums
}

const tryExtractAlbumsFromDom = (document) => {
  const albumAnchorElements = document.querySelectorAll(`[data-bind="css: {'featured': featured()}"] > a`)

  if (albumAnchorElements === undefined || albumAnchorElements === null) {
    return null
  }

  if (albumAnchorElements.length == 0) {
    return null
  }

  const albums = albumAnchorElements.map(anchorElement => {
    return {
      identifier: anchorElement.getAttribute("href").split("/").pop(),
      title: Array.from(anchorElement.querySelector("p").childNodes)
        .filter(n => n.nodeType == 3 /* Node.TEXT_NODE */)
        .map(n => n.textContent.trim())
        .shift(),
    }
  })

  return albums
}

const aborted = (...message) => {
  console.log(chalk.redBright("[Aborted]"), ...message)
}

const fetched = (...message) => {
  if (silent) return;
  console.log(chalk.magentaBright("[Fetched]"), ...message)
}

const downloaded = (...message) => {
  if (silent) return;
  console.log(chalk.cyanBright("[Downloaded]"), ...message)
}

await (async () => await run())()
