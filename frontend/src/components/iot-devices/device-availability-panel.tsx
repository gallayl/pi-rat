import { Shade, createComponent } from '@furystack/shades'
import type { Device } from 'common'
import { IotDevicesService } from '../../services/iot-devices-service.js'
import { Loader } from '@furystack/shades-common-components'
import { Icon } from '../Icon.js'
import { hasCacheValue } from '@furystack/cache'

export const DeviceAvailabilityPanel = Shade<Device>({
  shadowDomName: 'device-availability-panel',
  render: ({ props, useObservable, injector, useDisposable }) => {
    const iotService = injector.getInstance(IotDevicesService)

    const pingArgs: Parameters<typeof iotService.findPingHistoryAsObservable> = [
      props.name,
      { order: { createdAt: 'DESC' }, top: 1 },
    ]

    const wolEntryArgs: Parameters<typeof iotService.findAwakeHistoryAsObservable> = [
      props.name,
      { order: { createdAt: 'DESC' }, top: 1 },
    ]

    useDisposable('refresher', () => {
      const interval = setInterval(() => {
        iotService.findPingHistory(...pingArgs)
        iotService.findAwakeHistory(...wolEntryArgs)
      }, 1000)

      return { dispose: () => clearInterval(interval) }
    })

    const [lastPingState] = useObservable('pingState', iotService.findPingHistoryAsObservable(...pingArgs))

    if (lastPingState.status === 'failed') {
      return <Icon type="font" value="⚠️" title="Failed to load ping state" />
    }

    if (!hasCacheValue(lastPingState)) {
      return <Loader />
    }

    if (hasCacheValue(lastPingState)) {
      const lastPing = lastPingState.value.entries[0]

      if (!lastPing) {
        return (
          <Icon
            onclick={(ev) => {
              ev.stopPropagation()
              ev.preventDefault()
              iotService.pingDevice(props)
            }}
            type="font"
            value="❓"
            title="No ping found, status unknown. Will refresh soon"
            style={{
              cursor: 'pointer',
              opacity: lastPingState.status === 'obsolete' ? '0.5' : '1',
            }}
          />
        )
      }

      const hasFreshPingEntry = new Date(lastPing.createdAt) > new Date(Date.now() - 1000 * 60 * 1)

      if (!hasFreshPingEntry) {
        iotService.pingDevice(props).then(() => iotService.findPingHistory(...pingArgs))
      }

      if (lastPing.isAvailable && hasFreshPingEntry) {
        return (
          <Icon
            type="font"
            value="🟢"
            title="Device is available"
            style={{
              cursor: 'pointer',
              opacity: lastPingState.status === 'obsolete' ? '0.5' : '1',
            }}
          />
        )
      } else {
        const [lastWolEntryState] = useObservable(
          'wolEntryState',
          iotService.findAwakeHistoryAsObservable(...wolEntryArgs),
        )

        const hasFreshAwakeEntry =
          hasCacheValue(lastWolEntryState) &&
          lastWolEntryState.value.entries[0] &&
          new Date(lastWolEntryState.value.entries[0].createdAt) > new Date(Date.now() - 1000 * 60 * 1)

        if (hasFreshAwakeEntry) {
          return (
            <Icon
              type="font"
              value="😪"
              title="Device is not available, but was woken up recently"
              style={{
                cursor: 'pointer',
              }}
              onclick={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                iotService.pingDevice(props)
              }}
            />
          )
        }

        return (
          <Icon
            type="font"
            value="🔴"
            title="Device is not available. Click here to wake it up"
            onclick={(ev) => {
              ev.preventDefault()
              ev.stopPropagation()
              iotService
                .wakeUpDevice(props)
                .then(() => iotService.pingDevice(props))
                .then(() => iotService.findPingHistory(...pingArgs))
            }}
          />
        )
      }
    }

    return <div />
  },
})
