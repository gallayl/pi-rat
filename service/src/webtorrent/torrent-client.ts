import type { Injector } from '@furystack/inject'
import { Injectable } from '@furystack/inject'
import WebTorrent from 'webtorrent'
import { getDataFolder } from '../get-data-folder.js'
import { extname, join } from 'path'
import { readFile, readdir } from 'fs/promises'
import type { ApiTorrent, TorrentConfig } from 'common'
import { Drive } from 'common'
import { Config } from 'common'
import { getLogger } from '@furystack/logging'
import { StoreManager } from '@furystack/core'

@Injectable({ lifetime: 'singleton' })
export class TorrentClient extends WebTorrent {
  private readonly torrentsPath = join(getDataFolder(), 'torrents')

  private readonly inProgressPath = join(this.torrentsPath, 'in-progress')

  public async dispose() {
    await new Promise<void>((resolve, reject) => this.destroy((err) => (err ? reject(err) : resolve())))
  }

  public toApiTorrent(torrent: WebTorrent.Torrent): ApiTorrent {
    return {
      'announce-list': torrent['announce-list'],
      announce: torrent.announce,
      comment: torrent.comment,
      createdBy: torrent.createdBy,
      created: torrent.created,
      done: torrent.done,
      downloaded: torrent.downloaded,
      downloadSpeed: torrent.downloadSpeed,
      files: torrent.files.map((file) => ({
        downloaded: file.downloaded,
        length: file.length,
        name: file.name,
        path: file.path,
        progress: file.progress,
      })),
      infoHash: torrent.infoHash,
      lastPieceLength: torrent.lastPieceLength,
      length: torrent.length,
      magnetURI: torrent.magnetURI,
      maxWebConns: torrent.maxWebConns,
      name: torrent.name,
      numPeers: torrent.numPeers,
      path: torrent.path,
      pieceLength: torrent.pieceLength,
      pieces: torrent.pieces,
      progress: torrent.progress,
      ratio: torrent.ratio,
      received: torrent.received,
      ready: torrent.ready,
      torrentFile: torrent.torrentFile,
      torrentFileBlobURL: torrent.torrentFileBlobURL,
      timeRemaining: torrent.timeRemaining,
      uploaded: torrent.uploaded,
      uploadSpeed: torrent.uploadSpeed,
      paused: torrent.paused,
    }
  }

  public async init(injector: Injector) {
    const logger = getLogger(injector).withScope('TorrentClient config')

    await logger.verbose({ message: '🫴  Setting up Torrents...' })

    const storeManager = injector.getInstance(StoreManager)

    const [config] = await storeManager.getStoreFor(Config, 'id').find({
      filter: {
        type: {
          $eq: 'TORRENT_CONFIG',
        },
      },
      order: {
        updatedAt: 'DESC',
      },
      top: 1,
    })

    if (!config) {
      return logger.warning({ message: "❗ No torrent config found, torrents won't be initialized" })
    }

    const { torrentDriveLetter, torrentPath } = (config as TorrentConfig).value

    const drive = await storeManager.getStoreFor(Drive, 'letter').get(torrentDriveLetter)

    if (!drive) {
      return logger.warning({
        message: `❗ No drive found for letter ${torrentDriveLetter}, torrents won't be initialized`,
      })
    }

    const path = join(drive?.physicalPath, torrentPath)

    await Promise.all(
      this.torrents.map(
        (torrent) =>
          new Promise<void>((resolve, reject) =>
            torrent.destroy({ destroyStore: false }, (err) => (err ? reject(err) : resolve())),
          ),
      ),
    )

    const torrentFiles = await readdir(this.torrentsPath)
    const inProgressFiles = await readdir(this.inProgressPath)

    await Promise.all([
      inProgressFiles
        .filter((file) => extname(file) === '.torrent')
        .map(async (file) => {
          console.log('Adding running torrent', file)
          const fileContent = await readFile(join(this.inProgressPath, file))
          this.add(fileContent, { path })
        }),
    ])

    await Promise.all([
      torrentFiles
        .filter((file) => extname(file) === '.torrent')
        .map(async (file) => {
          console.log('Adding paused torrent', file)
          const fileContent = await readFile(join(this.torrentsPath, file))
          const instance = this.add(fileContent, { path })
          instance.pause()
        }),
    ])
  }
}
