/** @jsx jsx */ // <-- make sure to include the jsx pragma
import { React, jsx, type IMThemeVariables, type IntlShape } from 'jimu-core'
import { Label, Switch, Tooltip, Icon, CollapsablePanel, defaultMessages as jimuUIDefaultMessages, Select, Option } from 'jimu-ui'
import { SettingRow } from 'jimu-ui/advanced/setting-components'
import { getGeneralSettingsStyle } from '../lib/style'
import defaultMessages from '../translations/default'
import { type GeneralSetting } from '../../config'
import { getConfigIcon, onWidgetLoadOptions } from '../constants'

const { epConfigIcon } = getConfigIcon()

interface Props {
  intl: IntlShape
  theme: IMThemeVariables
  config: GeneralSetting
  onGeneralSettingsUpdated: (prop: string, value: string | boolean) => void
}

interface IState {
  activeTool: string
  isAppearanceSettingsOpen: boolean
}

export default class GeneralSettings extends React.PureComponent<Props, IState> {
  constructor (props) {
    super(props)
    let currentActiveTool = onWidgetLoadOptions[0].value
    //for backward compatibility
    if (this.props.config.isSelectToolActive) {
      currentActiveTool = onWidgetLoadOptions[1].value
    } else if (this.props.config.isDrawToolActive) {
      currentActiveTool = onWidgetLoadOptions[2].value
    }
    this.state = {
      activeTool: currentActiveTool,
      isAppearanceSettingsOpen: false
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

  componentDidMount = () => {
    // For backward compatibility, export option is toggled OFF for existing widget configurations
    // and toggled ON by default for newly added widgets
    this.props.onGeneralSettingsUpdated('allowExport', this.props.config.allowExport ? this.props.config.allowExport : false)
  }

  allowExportOptionChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onGeneralSettingsUpdated('allowExport', evt.target.checked)
  }

  onActiveToolChange = (evt) => {
    this.setState({
      activeTool: evt.target.value
    }, () => {
      setTimeout(() => {
        this.props.onGeneralSettingsUpdated('isSelectToolActive', evt.target.value === onWidgetLoadOptions[1].value)
      }, 50)
      setTimeout(() => {
        this.props.onGeneralSettingsUpdated('isDrawToolActive', evt.target.value === onWidgetLoadOptions[2].value)
      }, 50)
    })
  }

  onToggleAppearance = () => {
    this.setState({
      isAppearanceSettingsOpen: !this.state.isAppearanceSettingsOpen
    })
  }

  onShowGridChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onGeneralSettingsUpdated('showGridAxis', evt.target.checked)
  }

  onShowAxisTitlesChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onGeneralSettingsUpdated('showAxisTitles', evt.target.checked)
  }

  legendStateChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onGeneralSettingsUpdated('showLegend', evt.target.checked)
  }

  render () {
    return <div style={{ height: '100%', width: '100%', marginTop: 5 }} css={getGeneralSettingsStyle(this.props.theme)}>
      <SettingRow label={this.nls('allowExportLabel')}>
        <Switch role={'switch'} aria-label={this.nls('allowExportLabel')}
          title={this.nls('allowExportLabel')}
          checked={this.props.config.allowExport ? this.props.config.allowExport : false}
          onChange={this.allowExportOptionChange} />
      </SettingRow>
      <SettingRow>
        <Label tabIndex={0} aria-label={this.nls('activateToolOnLoadLabel')} className='w-100 d-flex' >
          <div className='flex-grow-1 text-break'>
            {this.nls('activateToolOnLoadLabel')}
          </div>
        </Label>
        <Tooltip role={'tooltip'} tabIndex={0} aria-label={this.nls('activateToolOnLoadTooltip')}
          title={this.nls('activateToolOnLoadTooltip')} showArrow placement='top'>
          <div className='ml-2 d-inline'>
            <Icon size={14} icon={epConfigIcon.infoIcon} />
          </div>
        </Tooltip>
      </SettingRow>

      <SettingRow>
        <Select menuRole={'menu'} aria-label={this.nls('activateToolOnLoadLabel')} className={'selectOption'}
          size={'sm'} name={'activateToolOnLoad'}
          value={this.state.activeTool}
          onChange={this.onActiveToolChange}
          >
          {onWidgetLoadOptions.map((option, index) => {
            return <Option role={'option'} aria-label={this.nls(option.name)} key={index} value={option.value}>
              {this.nls(option.name)}</Option>
          })}
        </Select>
      </SettingRow>

      <SettingRow>
        <CollapsablePanel
          label={this.nls('appearanceCollapsible')}
          isOpen={this.state.isAppearanceSettingsOpen}
          onRequestOpen={() => { this.onToggleAppearance() }}
          onRequestClose={() => { this.onToggleAppearance() }}>
          <div style={{ height: '100%', marginTop: 10 }}>

            <SettingRow label={this.nls('showChartGridsLabel')}>
              <Switch role={'switch'} aria-label={this.nls('showChartGridsLabel')}
                title={this.nls('showChartGridsLabel')}
                checked={this.props.config.showGridAxis}
                onChange={this.onShowGridChange} />
            </SettingRow>

            <SettingRow label={this.nls('showChartAxisTitlesLabel')}>
              <Switch role={'switch'} aria-label={this.nls('showChartAxisTitlesLabel')}
                title={this.nls('showChartAxisTitlesLabel')}
                checked={this.props.config.showAxisTitles}
                onChange={this.onShowAxisTitlesChange} />
            </SettingRow>

            <SettingRow label={this.nls('showLegend')}>
              <Switch role={'switch'} aria-label={this.nls('showLegend')}
                title={this.nls('showLegend')}
                checked={this.props.config.showLegend}
                onChange={this.legendStateChange} />
            </SettingRow>
          </div>
        </CollapsablePanel>
      </SettingRow>
    </div>
  }
}
