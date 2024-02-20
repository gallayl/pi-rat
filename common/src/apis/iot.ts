import type {
  DeleteEndpoint,
  GetCollectionEndpoint,
  GetEntityEndpoint,
  PatchEndpoint,
  PostEndpoint,
  RestApi,
} from '@furystack/rest'
import type { Device, DeviceAwakeHistory, DevicePingHistory } from '../index.js'

export type PostDeviceEndpoint = PostEndpoint<Omit<Device, 'createdAt' | 'updatedAt'>, 'name'>

export type AwakeEndpoint = { url: { id: string }; result: { success: boolean } }
export type PingEndpoint = { url: { id: string }; result: { success: boolean; ping?: number } }

export interface IotApi extends RestApi {
  GET: {
    '/devices': GetCollectionEndpoint<Device>
    '/devices/:id': GetEntityEndpoint<Device, 'name'>
    '/device-ping-history': GetCollectionEndpoint<DevicePingHistory>
    '/device-awake-history': GetCollectionEndpoint<DeviceAwakeHistory>
  }
  POST: {
    '/devices': PostDeviceEndpoint
    '/devices/:id/awake': AwakeEndpoint
    '/devices/:id/ping': PingEndpoint
  }
  PATCH: {
    '/devices/:id': PatchEndpoint<Device, 'name', 'name' | 'ipAddress' | 'macAddress'>
  }
  DELETE: {
    '/devices/:id': DeleteEndpoint<Device, 'name'>
  }
}
