import { createComponent, Shade } from '@furystack/shades'
import { CollectionService, DataGrid, SelectionCell } from '@furystack/shades-common-components'
import type { DirectoryEntry } from 'common/src/models/directory-entry'
import { DrivesApiClient } from '../../services/drives-api-client'

export const FileList = Shade<{
  currentDriveLetter?: string
  currentPath?: string
  onActivate?: (entry: DirectoryEntry) => void
}>({
  shadowDomName: 'file-list',
  render: ({ useDisposable, props, injector }) => {
    const service = useDisposable(
      'service',
      () =>
        new CollectionService<DirectoryEntry>({
          loader: async () => {
            if (!props.currentDriveLetter || !props.currentPath) {
              return { count: 0, entries: [] }
            }

            const up: DirectoryEntry = {
              name: '..',
              isDirectory: true,
              isBlockDevice: false,
              isCharacterDevice: false,
              isFIFO: false,
              isFile: false,
              isSocket: false,
              isSymbolicLink: false,
            }

            const result = await injector.getInstance(DrivesApiClient).call({
              method: 'GET',
              action: '/files/:letter/:path',
              url: {
                letter: props.currentDriveLetter,
                path: encodeURIComponent(props.currentPath),
              },
            })
            if (props.currentPath !== '/') {
              return { ...result.result, entries: [up, ...result.result.entries] }
            }
            return result.result
          },
          defaultSettings: {},
        }),
    )

    const activate = () => {
      const focused = service.focusedEntry.getValue()
      focused && props.onActivate?.(focused)
    }

    return (
      <div
        ondblclick={activate}
        onkeydown={(ev) => {
          if (ev.key === 'Enter') {
            activate()
          }
        }}>
        <DataGrid<DirectoryEntry & { id: any }>
          service={service as any}
          autofocus
          columns={['id', 'name']}
          headerComponents={{}}
          styles={{}}
          rowComponents={{
            name: ({ name }) => <>{name}</>,
            id: (entry) => <SelectionCell entry={entry} service={service} />,
          }}
        />
      </div>
    )
  },
})
