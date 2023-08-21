import { createComponent, Shade } from '@furystack/shades'
import type { Drive } from 'common'
import { DrivesService } from '../../services/drives-service.js'
import { ErrorDisplay } from '../../components/error-display.js'
import type { DriveLocation } from './index.js'

export const DriveSelector = Shade<{
  currentDrive: DriveLocation
  setCurrentDrive: (newDriveLetter: DriveLocation) => void
}>({
  shadowDomName: 'drive-selector',
  render: ({ props, useObservable, injector }) => {
    const drivesService = injector.getInstance(DrivesService)
    const [availableDrives] = useObservable('availableDrives', drivesService.getVolumesAsObservable({}))

    if (availableDrives.status === 'loading' || availableDrives.status === 'uninitialized') {
      return null // TODO: Skeleton
    }

    if (availableDrives.status === 'failed') {
      return <ErrorDisplay error={availableDrives.error} />
    }

    return (
      <select
        onchange={(ev) => {
          const { value } = ev.target as HTMLOptionElement
          props.setCurrentDrive({
            letter: (availableDrives.value?.entries.find((e) => e.letter === value) as Drive).letter,
            path: '/',
          })
        }}>
        {availableDrives.value.entries.map((r) => (
          <option value={r.letter} selected={props.currentDrive.letter === r.letter}>
            {r.letter}
          </option>
        ))}
      </select>
    )
  },
})
