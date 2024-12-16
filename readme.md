# band-dl

A neet and small command line utility to download an artist's entire discography or
specific albums without the use of Puppeteer or any other headless browser dependency.

- [How to install](#how-to-install)
- [How to use](#how-to-use)
- [How does it work](#how-does-it-work)- [How to install](#how-to-install)
- [How to use](#how-to-use)
  - [Download entire discography](#download-entire-discography)
    * [Example](#example)
  - [Download specific album(s)](#download-specific-albums)
    * [Example](#example-1)
- [How does it work](#how-does-it-work)


# How to install
```bash
npm install -g band-dl
```
_or from cloned repository_
```bash
npm link
```

# How to use

#### Download entire discography
```bash
band-dl <artist-identifier>
```

- `<artist-identifier>`: `https://<artist-identifier>.bandcamp.com/music`

##### Example
```bash
band-dl fictionalartist
```

---

#### Download specific album(s)
```bash
band-dl <artist-identifier> [album-identifier] [album-identifier] ...
```

- `<artist-identifier>`: `https://<artist-identifier>.bandcamp.com/music`.

- `[album-identifier]`: `https://<artist-identifier>.bandcamp.com/album/[album-identifier]`.

##### Example
```bash
band-dl fictionalartist album1 album2 album3
```

# How does it work

`band-dl` fetches the HTML of the Bandcamp's artist or album page and analyzes the
album data in the DOM. From that album data we can extract the songs and the direct
links to the respective mp3 files.
