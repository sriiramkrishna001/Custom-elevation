/* eslint-disable no-prototype-builtins */
/** @jsx jsx */
import { React, jsx, type IntlShape } from 'jimu-core'
import { Select, Option, NumericInput, Icon, defaultMessages as jimuUIDefaultMessages } from 'jimu-ui'
import { ColorPicker } from 'jimu-ui/basic/color-picker'
import { SettingRow } from 'jimu-ui/advanced/setting-components'
import { type AssetStyle, type ProfileStyle } from '../../config'
import defaultMessages from '../translations/default'
import { lineTypeList } from '../constants'

interface Props {
  intl: IntlShape
  lineItem: string
  config: ProfileStyle | AssetStyle
  onLineStyleChange: (objectKey: string, property: string, style: any) => void
}

interface IState {
  lineColor: string
  lineType: string
  lineThickness: number
}

export default class LineStylePicker extends React.PureComponent<Props, IState> {
  constructor (props) {
    super(props)
    const lineConfig: any = this.props.config
    this.state = {
      lineColor: lineConfig.hasOwnProperty('lineColor') ? lineConfig.lineColor : '#049546',
      lineType: lineConfig.hasOwnProperty('lineType') ? lineConfig.lineType : 'dashed-line',
      lineThickness: lineConfig.hasOwnProperty('lineThickness') ? lineConfig.lineThickness : 2
    }
  }

  nls = (id: string) => {
    const messages = Object.assign({}, defaultMessages, jimuUIDefaultMessages)
    //for unit testing no need to mock intl we can directly use default en msg
    if (this.props.intl && this.props.intl.formatMessage) {
      return this.props.intl.formatMessage({ id: id, defaultMessage: messages[id] })
    } else {
      return messages[id]
    }
  }

  onLineColorChange = (color: string) => {
    this.setState({
      lineColor: color
    })
    this.props.onLineStyleChange(this.props.lineItem, 'lineColor', color)
  }

  onlineTypeChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      lineType: evt.currentTarget.value
    })
    this.props.onLineStyleChange(this.props.lineItem, 'lineType', evt.currentTarget.value)
  }

  onLineThicknessChange = (value: number) => {
    if (value === null) {
      return
    }

    this.setState({
      lineThickness: value
    })
    this.props.onLineStyleChange(this.props.lineItem, 'lineThickness', value)
  }

  render () {
    return <div>
      <SettingRow>
        <ColorPicker aria-label={this.nls('styleColor')} className={'mr-2'} width='54px' height='26px'
        offset={[0, 0]} placement={'auto'} showArrow color={this.state.lineColor ? this.state.lineColor : '#FFFFFF'}
        onChange={this.onLineColorChange} />
        <Select menuRole={'menu'} aria-label={this.nls('styleShape') + this.state.lineType} size={'sm'} name={'linePicker'} value={this.state.lineType}
          onChange={this.onlineTypeChange}>
          {lineTypeList.map((item, index) => {
            const iconComponent = require(`../assets/icons/${item.value}.svg`)
            return <Option role={'option'} aria-label={item} key={index} value={item.value} title={this.nls(item.label)}>
              {<Icon width={60} height={12} icon={iconComponent} />}
            </Option>
          })}
        </Select>
        <NumericInput aria-label={this.nls('styleSize')} size={'sm'} className={'ml-2'} min={1} max={20} defaultValue={this.state.lineThickness} onChange={this.onLineThicknessChange} />
      </SettingRow>
    </div>
  }
}
