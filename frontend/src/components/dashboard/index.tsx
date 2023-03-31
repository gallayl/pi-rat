import { Shade, createComponent } from '@furystack/shades'
import type { Dashboard as DashboardData } from 'common'
import { Widget } from './widget'
import { Paper } from '@furystack/shades-common-components'

export const Dashboard = Shade<DashboardData>({
  shadowDomName: 'pi-rat-dashboard',
  render: ({ props }) => {
    return (
      <Paper
        style={{
          paddingTop: '2em',
          display: 'flex',
          flexDirection: 'column',
        }}>
        {props.widgets.map((w) => (
          <Widget {...w} />
        ))}
      </Paper>
    )
  },
})
