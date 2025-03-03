import { Cache } from '@furystack/cache'
import type { FindOptions } from '@furystack/core'
import { Injectable, Injected } from '@furystack/inject'
import type { Device, DeviceAwakeHistory, DevicePingHistory } from 'common'
import { IotApiClient } from './api-clients/iot-api-client.js'
import { WebsocketNotificationsService } from './websocket-events.js'

@Injectable({ lifetime: 'singleton' })
export class IotDevicesService {
  @Injected(WebsocketNotificationsService)
  declare readonly websocketNotificationsService: WebsocketNotificationsService

  @Injected(IotApiClient)
  declare private readonly iotApiClient: IotApiClient

  private deviceCache = new Cache({
    capacity: 100,
    load: async (id: string) => {
      const { result } = await this.iotApiClient.call({
        method: 'GET',
        action: '/devices/:id',
        url: { id },
        query: {},
      })
      return result
    },
  })

  private deviceQueryCache = new Cache({
    capacity: 100,
    load: async (findOptions: FindOptions<Device, Array<keyof Device>>) => {
      const { result } = await this.iotApiClient.call({
        method: 'GET',
        action: '/devices',
        query: {
          findOptions,
        },
      })

      result.entries.forEach((entry) => {
        this.deviceCache.setExplicitValue({
          loadArgs: [entry.name],
          value: { status: 'loaded', value: entry, updatedAt: new Date() },
        })
      })

      return result
    },
  })

  private deviceAwakeHistoryCache = new Cache({
    capacity: 100,
    load: async (name: string, query?: FindOptions<DeviceAwakeHistory, Array<keyof DeviceAwakeHistory>>) => {
      const { result } = await this.iotApiClient.call({
        method: 'GET',
        action: '/device-awake-history',
        query: {
          findOptions: {
            ...query,
            filter: {
              $and: [{ name: { $eq: name } }, ...(query?.filter ? [query.filter] : [])],
            },
          },
        },
      })
      return result
    },
  })

  private devicePingHistoryCache = new Cache({
    capacity: 100,
    load: async (deviceName: string, query?: FindOptions<DevicePingHistory, Array<keyof DevicePingHistory>>) => {
      const { result } = await this.iotApiClient.call({
        method: 'GET',
        action: '/device-ping-history',
        query: {
          findOptions: {
            ...query,
            filter: {
              $and: [...(query?.filter ? [query.filter] : []), { name: { $eq: deviceName } }],
            },
          },
        },
      })
      return result
    },
  })

  public getDevice = this.deviceCache.get.bind(this.deviceCache)
  public getDeviceAsObservable = this.deviceCache.getObservable.bind(this.deviceCache)

  public findDevice = this.deviceQueryCache.get.bind(this.deviceQueryCache)
  public findDeviceAsObservable = this.deviceQueryCache.getObservable.bind(this.deviceQueryCache)

  public findPingHistory = this.devicePingHistoryCache.get.bind(this.devicePingHistoryCache)
  public findPingHistoryAsObservable = this.devicePingHistoryCache.getObservable.bind(this.devicePingHistoryCache)

  public findAwakeHistory = this.deviceAwakeHistoryCache.get.bind(this.deviceAwakeHistoryCache)
  public findAwakeHistoryAsObservable = this.deviceAwakeHistoryCache.getObservable.bind(this.deviceAwakeHistoryCache)

  public deleteDevice = async (name: string) => {
    await this.iotApiClient.call({
      method: 'DELETE',
      action: '/devices/:id',
      url: { id: name },
    })
    this.deviceCache.remove(name)
    this.deviceQueryCache.flushAll()
    this.deviceAwakeHistoryCache.flushAll()
    this.devicePingHistoryCache.flushAll()
  }

  public updateDevice = async (name: string, body: Pick<Device, 'ipAddress' | 'macAddress' | 'name'>) => {
    await this.iotApiClient.call({
      method: 'PATCH',
      action: '/devices/:id',
      url: { id: name },
      body,
    })

    void this.deviceCache.reload(name)
    this.deviceQueryCache.flushAll()
    this.deviceAwakeHistoryCache.flushAll()
    this.devicePingHistoryCache.flushAll()
  }

  public addDevice = async (body: Omit<Device, 'createdAt' | 'updatedAt'>) => {
    const result = await this.iotApiClient.call({
      method: 'POST',
      action: '/devices',
      body,
    })
    this.deviceQueryCache.flushAll()
    return result
  }

  public wakeUpDevice = async (device: Device) => {
    await this.iotApiClient.call({
      method: 'POST',
      action: '/devices/:id/awake',
      url: { id: device.name },
    })
    this.deviceAwakeHistoryCache.obsoleteRange((_, args) => args[0] === device.name)
    this.devicePingHistoryCache.obsoleteRange((_, args) => args[0] === device.name)
  }

  public pingDevice = async (device: Device) => {
    this.deviceAwakeHistoryCache.obsoleteRange((_, args) => args[0] === device.name)
    this.devicePingHistoryCache.obsoleteRange((_, args) => args[0] === device.name)

    await this.iotApiClient.call({
      method: 'POST',
      action: '/devices/:id/ping',
      url: { id: device.name },
    })
  }

  public observeLastPingForDevice = (device: Device) =>
    this.findPingHistoryAsObservable(device.name, { top: 1, order: { createdAt: 'DESC' } })

  public reloadLastPingForDevice = (device: Device) =>
    this.devicePingHistoryCache.reload(device.name, { top: 1, order: { createdAt: 'DESC' } })

  public observeLastAwakeEntryForDevice = (device: Device) =>
    this.findAwakeHistoryAsObservable(device.name, { top: 1, order: { createdAt: 'DESC' } })

  public reloadLastAwakeEntryForDevice = (device: Device) =>
    this.deviceAwakeHistoryCache.reload(device.name, { top: 1, order: { createdAt: 'DESC' } })

  public init() {
    this.websocketNotificationsService.addListener('onMessage', (message) => {
      if (message.type === 'device-connected' || message.type === 'device-disconnected') {
        void void this.deviceCache.reload(message.device.name)
        this.deviceAwakeHistoryCache.obsoleteRange((v) => v.entries.some((e) => e.name === message.device.name))
        this.devicePingHistoryCache.obsoleteRange((v) => v.entries.some((e) => e.name === message.device.name))
        void this.devicePingHistoryCache.reload(message.device.name, { top: 1, order: { createdAt: 'DESC' } })
      }
    })
  }
}
