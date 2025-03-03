/** @jsx jsx */
import { React, jsx, DataSourceManager, defaultMessages as jimuCoreDefaultMessages, getAppStore, Immutable, type FieldSchema, JimuFieldType, type DataSourceSchema, type DataSourceJson, DataSourceTypes, classNames } from 'jimu-core'
import { Icon, Tooltip, Alert, Label, CollapsablePanel, defaultMessages as jimuUIDefaultMessages, Switch, Radio, Loading, LoadingType } from 'jimu-ui'
import { MapWidgetSelector, SettingSection, SettingRow, MultipleJimuMapConfig } from 'jimu-ui/advanced/setting-components'
import { BaseWidgetSetting, type AllWidgetSettingProps } from 'jimu-for-builder'
import { type JimuMapView, MapViewManager, type FeatureLayerDataSource } from 'jimu-arcgis'
import { type StatisticsAttributes, type IMConfig, type Statistics } from '../config'
import defaultMessages from './translations/default'
import { getStyle, getStyleForLI } from './lib/style'
import { defaultConfiguration, defaultProfileSettings, epStatistics, defaultElevationLayer, getConfigIcon } from './constants'
import ProfileSetting from './components/profile-settings'
import ProfileChartSettings from './components/profile-chart-settings'
import GeneralSettings from './components/general-setting'
import { getAllLayersFromDataSource, defaultSelectedUnits, getRandomHexColor, waitForChildDataSourcesReady, getUseDataSourcesForAllDs } from '../common/utils'
import AssetSetting from './components/asset-settings'
import { ClickOutlined } from 'jimu-icons/outlined/application/click'

const { epConfigIcon } = getConfigIcon()

interface State {
  showLayersSettings: boolean
  dataSourceName: string
  isProfileChartSettingsOpen: boolean
  activeDataSource: string
  availableStats: Statistics[]
  isNoMapSelected: boolean
  mapWidgetExists: boolean
  useMapWidget: string[]
  showLoadingIndicator: boolean
}

export default class Setting extends BaseWidgetSetting<AllWidgetSettingProps<IMConfig>, State> {
  readonly mvManager: MapViewManager = MapViewManager.getInstance()
  private dataSourceOptions = []
  private groundData = []
  private _mapLoadedTimer = null
  private _mapViewGroupLoad = null
  readonly isRTL: boolean
  private availableLineLayers = []
  private availablePointLayers = []
  mapView: JimuMapView

  constructor (props) {
    super(props)
    this.state = {
      showLayersSettings: false,
      dataSourceName: '',
      isProfileChartSettingsOpen: false,
      activeDataSource: this.props.config.activeDataSource ? this.props.config.activeDataSource : null,
      availableStats: [],
      isNoMapSelected: true,
      mapWidgetExists: true,
      useMapWidget: null,
      showLoadingIndicator: true
    }

    this.isRTL = false

    const appState = getAppStore().getState()
    this.isRTL = appState?.appContext?.isRTL
  }

  componentDidMount = () => {
    //Compare the saved data with current map view data sources
    //and filter out the data sources which are not available in the map view
    //this will make sure to remove the data sources which are not available in the map view
    //populate configured data sources for map
    let isNoneMapSelected: boolean
    if (this.props.useMapWidgetIds && this.props.useMapWidgetIds.length > 0) {
      const useMapWidget = this.props.useMapWidgetIds?.[0]
      const appConfig = getAppStore().getState().appStateInBuilder.appConfig
      const mapWidgetAvailable = appConfig.widgets?.[useMapWidget]
      if (!mapWidgetAvailable) {
        this.resetConfig(this.props.useMapWidgetIds)
        isNoneMapSelected = true
      } else {
        isNoneMapSelected = false
        this.createStatistics()
        this.setState({
          useMapWidget: this.props.useMapWidgetIds as any
        }, () => {
          this.getAvailableDataSources(this.props.useMapWidgetIds)
        })
      }
    } else { //display the warning message to select the webmap or webscene
      isNoneMapSelected = true
      const newConfig = this.props.config.set('configInfo', {})
      const settings: any = {
        id: this.props.id,
        useMapWidgetIds: this.props.useMapWidgetIds?.length > 0 ? this.props.useMapWidgetIds : null,
        config: newConfig
      }
      settings.useDataSources = Immutable([])
      //Reset analysis layers config parameters
      this.props.onSettingChange(settings, [])
    }
    this.updateConfigForMapWidget(isNoneMapSelected)
  }

  componentDidUpdate = (prevProps) => {
    //check if the widget label is changed from the config
    if (prevProps.label !== this.props.label) {
      const outputDsJsons: DataSourceJson[] = [this.getInitOutDataSource()]
      setTimeout(() => {
        this.props.onSettingChange({
          id: this.props.id,
          useDataSources: []
        }, outputDsJsons)
      }, 100)
    }
  }

  nls = (id: string) => {
    const messages = Object.assign({}, defaultMessages, jimuUIDefaultMessages, jimuCoreDefaultMessages)
    //for unit testing no need to mock intl we can directly use default en msg
    if (this.props.intl && this.props.intl.formatMessage) {
      return this.props.intl.formatMessage({ id: id, defaultMessage: messages[id] })
    } else {
      return messages[id]
    }
  }

  updateConfigForMapWidget = (isMapWidgetAvailable: boolean) => {
    this.setState({
      mapWidgetExists: !isMapWidgetAvailable,
      isNoMapSelected: isMapWidgetAvailable
    })
  }

  onMapWidgetSelected = (useMapWidgetIds: string[]) => {
    let isNoneMapSelected: boolean
    if (useMapWidgetIds.length > 0) {
      isNoneMapSelected = false
      this.createStatistics()
      this.setState({
        useMapWidget: useMapWidgetIds
      }, () => {
        this.getAvailableDataSources(useMapWidgetIds)
      })
    } else { //display the warning message to select the webmap or webscene
      isNoneMapSelected = true
      const newConfig = this.props.config.set('configInfo', {})
      const settings: any = {
        id: this.props.id,
        useMapWidgetIds: useMapWidgetIds?.length > 0 ? useMapWidgetIds : null,
        config: newConfig
      }
      settings.useDataSources = Immutable([])
      //Reset analysis layers config parameters
      this.props.onSettingChange(settings, [])
    }
    this.updateConfigForMapWidget(isNoneMapSelected)
  }

  createStatistics = () => {
    const avalaibleStatistics: any[] = epStatistics
    const allAvailableStats: Statistics[] = []
    //all available statistics present in JS API widget
    avalaibleStatistics.forEach((stat) => {
      const supportedStats: Statistics = {
        name: stat.value,
        label: this.nls(stat.value),
        enabled: true
      }
      allAvailableStats.push(supportedStats)
    })
    allAvailableStats.sort((a, b) => a.label.localeCompare(b.label))

    this.setState({
      availableStats: allAvailableStats
    })
  }

  resetConfig = (useMapWidgetIds) => {
    //Reset config parameters
    const outputDsJsons: DataSourceJson[] = [this.getInitOutDataSource()]
    const newConfig = this.props.config.set('configInfo', {})
    const settings: any = {
      id: this.props.id,
      useMapWidgetIds: useMapWidgetIds?.length > 0 ? useMapWidgetIds : null,
      config: newConfig
    }
    if (useMapWidgetIds?.length === 0) {
      settings.useDataSources = Immutable([])
      //Reset analysis layers config parameters
      this.props.onSettingChange(settings, [])
    } else {
      //Reset analysis layers config parameters
      this.props.onSettingChange(settings, outputDsJsons)
    }
  }

  //on widget load check the line and point layers availability and set the hint and warning messages accordingly
  checkForLayersAvailability = (activeDataSource: string) => {
    this.availableLineLayers = []
    this.availablePointLayers = []
    const allLayerSources: any = getAllLayersFromDataSource(activeDataSource)
    allLayerSources?.forEach((layer: FeatureLayerDataSource) => {
      if (layer.getLayerDefinition()?.geometryType === 'esriGeometryPolyline') {
        this.availableLineLayers.push(layer)
      }

      if (layer.getLayerDefinition()?.geometryType === 'esriGeometryPolyline' ||
          layer.getLayerDefinition()?.geometryType === 'esriGeometryPoint') {
        this.availablePointLayers.push(layer)
      }
    })
  }

  getConfigForSelectedDs = (activeDataSource: string, newConfig, isGroundLayer: boolean, groundElevationLayerUrl: string) => {
    this.checkForLayersAvailability(activeDataSource)
    // eslint-disable-next-line no-prototype-builtins
    if (!newConfig.configInfo.hasOwnProperty(activeDataSource)) {
      const config = defaultConfiguration
      //If config is open for the first time then create the default config
      config.profileChartSettings.isCustomElevationLayer = !isGroundLayer
      //If no ground elevation layer available in webmap/webscene then set as custom elevation layer
      let elevationLayerURL = defaultElevationLayer

      if (isGroundLayer) {
        elevationLayerURL = groundElevationLayerUrl
      }
      config.profileChartSettings.elevationLayerURL = elevationLayerURL
      config.profileChartSettings.selectedStatistics = this.state.availableStats
      config.profileChartSettings.volumetricObjLabel = this.nls('volumetricObjectsLabel')

      config.profileSettings.layers = activeDataSource !== 'default'
        ? this.populateDefaultProfileSettings(activeDataSource)
        : []
      return newConfig.setIn(['configInfo', activeDataSource], config)
    }
    return newConfig
  }

  /**
    * Get outputDs json
  */
  getInitOutDataSource = () => {
    const messages = Object.assign({}, jimuUIDefaultMessages)
    const dsLabel = this.props.intl.formatMessage({ id: 'outputStatistics', defaultMessage: messages.outputStatistics }, { name: this.props.label })
    const dsId = `${this.props.widgetId}-output`
    const schema = this.getInitSchema(dsLabel)

    const outputDsJson: DataSourceJson = {
      id: dsId,
      type: DataSourceTypes.FeatureLayer,
      label: dsLabel,
      originDataSources: [],
      isOutputFromWidget: true,
      isDataInDataSourceInstance: false,
      schema,
      geometryType: 'esriGeometryPolyline'
    }

    return outputDsJson
  }

  /**
  * Get outputDs default schema to generate the output json
  */
  getInitSchema = (label: string = '') => {
    const fields: StatisticsAttributes = {}
    const statsFields: FieldSchema[] = []
    statsFields.push({
      alias: 'OBJECTID',
      type: JimuFieldType.Number,
      jimuName: 'OBJECTID',
      name: 'OBJECTID'
    })

    epStatistics.forEach((stats) => {
      const statsValue = this.nls(stats.value).replace(/ /g, '')
      statsFields.push({
        alias: statsValue,
        type: JimuFieldType.String,
        jimuName: stats.value,
        name: stats.value
      })
    })

    statsFields?.forEach((fieldSchema, index) => {
      fields[fieldSchema?.jimuName] = fieldSchema
      if (index === 0) {
        fields.OBJECTID = fieldSchema
      }
    })

    return {
      label,
      idField: 'OBJECTID',
      fields: fields
    } as DataSourceSchema
  }

  populateDefaultProfileSettings = (activeDataSource: string) => {
    const geometryType = 'esriGeometryPolyline'
    const defaultConfig = []
    const allLayerSources: any = getAllLayersFromDataSource(activeDataSource)
    const defaultUnits = defaultSelectedUnits(this.props.config.configInfo[activeDataSource], this.props.portalSelf)
    //If the config is opened for first time then create the default config
    allLayerSources?.forEach((layer) => {
      if (layer.getLayerDefinition()?.geometryType === geometryType) {
        let defaultElevationType = 'no elevation'
        //if layer having elevation info then set default elevation type as z
        if (layer.getLayerDefinition().hasZ) {
          defaultElevationType = 'z'
        }
        const defaultProfileSettingsObj = Object.assign({}, defaultProfileSettings)
        //if shape length field available in the layer use it as default distance field
        if (layer?.getLayerDefinition()?.hasGeometryProperties &&
          layer?.getLayerDefinition()?.geometryProperties?.shapeLengthFieldName) {
          defaultProfileSettingsObj.distanceSettings.field = layer.getLayerDefinition().geometryProperties.shapeLengthFieldName
        }
        const layerObject = Object.assign({}, defaultProfileSettingsObj)
        layerObject.layerId = layer.id
        layerObject.elevationSettings.type = defaultElevationType
        layerObject.elevationSettings.unit = defaultUnits[0]
        layerObject.distanceSettings.unit = defaultUnits[1]
        layerObject.style.lineColor = getRandomHexColor()
        defaultConfig.push(Immutable(layerObject))
      }
    })
    return defaultConfig
  }

  getDataSourceLabel = (dataSourceId: string): string => {
    if (!dataSourceId) {
      return ''
    }
    const dsObj = DataSourceManager.getInstance().getDataSource(dataSourceId)
    const label = dsObj.getLabel()
    return label || dataSourceId
  }

  updateConfigAsPerNewWebMap = (newConfig) => {
    const dataSourcesToMatch = []
    let config = newConfig.configInfo.asMutable({ deep: true })
    if (this.state.useMapWidget) {
      const getMapViewGroup = this.getMapViewGroupInstance(this.state.useMapWidget[0])
      const updatedMapViewGroups = getMapViewGroup[0]
      const mapWidgetInstance = getMapViewGroup[1]

      if (updatedMapViewGroups && updatedMapViewGroups.jimuMapViews) {
        for (const id in updatedMapViewGroups.jimuMapViews) {
          if (updatedMapViewGroups.jimuMapViews[id].dataSourceId) {
            dataSourcesToMatch.push(updatedMapViewGroups.jimuMapViews[id].dataSourceId)
          } else {
            dataSourcesToMatch.push('default')
          }
        }
      }
      //Remove unwanted data from config
      //Apply specific condition to avoid deletion of config if there are two webmaps/webscene but they are not fully loaded
      if (mapWidgetInstance?.props?.useDataSources?.length !== 2) {
        for (const dsId in config) {
          if (dsId !== 'useMapWidgetIds' && dsId !== 'activeDataSource' &&
            !dataSourcesToMatch.includes(dsId)) {
            delete config[dsId]
          } else {
            config = this.updateLayersFromConfig(dsId, newConfig)
          }
        }
      }
    }
    return newConfig.set('configInfo', Immutable(config))
  }

  updateLayersFromConfig = (activeDataSource: string, config) => {
    const pointLayerIds = []
    const lineLayerIds = []
    const assetSettingsLayerIds = []
    const profileSettingsLayerIds = []
    const propsConfigInfo = config.configInfo.asMutable({ deep: true })
    const configInfo = config.configInfo.asMutable({ deep: true })
    const dataSource: any = getAllLayersFromDataSource(activeDataSource)
    dataSource?.forEach((layer: FeatureLayerDataSource) => {
      if (layer && layer.getLayerDefinition() && layer.getLayerDefinition().geometryType) { //for feature layer
        if (layer.getLayerDefinition().geometryType === 'esriGeometryPoint') {
          pointLayerIds.push(layer.id)
        } else if (layer.getLayerDefinition().geometryType === 'esriGeometryPolyline') {
          lineLayerIds.push(layer.id)
        }
      }
    })

    //Loop through all profile settings configuration
    //Any layer which does not falls in the point or line layer arrays
    //are not present in the webmap/webscene
    //delete those layers from the configuration
    propsConfigInfo[activeDataSource].profileSettings?.layers?.forEach((layerDetails, index: number) => {
      if (!lineLayerIds.includes(layerDetails.layerId)) {
        configInfo[activeDataSource].profileSettings.layers.splice(index, 1)
      } else {
        profileSettingsLayerIds.push(layerDetails.layerId)
      }
    })

    propsConfigInfo[activeDataSource].assetSettings?.layers?.forEach((layerDetails, index: number) => {
      if (!pointLayerIds.includes(layerDetails.layerId) && !lineLayerIds.includes(layerDetails.layerId)) {
        configInfo[activeDataSource].assetSettings.layers.splice(index, 1)
      } else {
        assetSettingsLayerIds.push(layerDetails.layerId)
      }
    })

    return configInfo
  }

  /**
   * Get updated map view group and map widget instance if user clicks on widget without fully loading the webmap/webscene
  */
  getMapViewGroupInstance = (useMapWidgetIds) => {
    const mapViewGroups = this.mvManager.getJimuMapViewGroup(useMapWidgetIds)
    let updatedMapViewGroups = mapViewGroups
    let mapWidgetInstance: any = updatedMapViewGroups?.mapWidgetInstance

    if (this._mapViewGroupLoad) {
      clearInterval(this._mapViewGroupLoad)
    }

    if (mapViewGroups) {
      const jimuMapViewsFirst = mapViewGroups.mapWidgetId + '-' + mapWidgetInstance.props.useDataSources?.[0]?.dataSourceId
      const jimuMapViewsSecond = mapViewGroups.mapWidgetId + '-' + mapWidgetInstance.props.useDataSources?.[1]?.dataSourceId
      //Create data sources on the basis of active webmap/webscene
      if (mapWidgetInstance.props.useDataSources?.length === 2) {
        // eslint-disable-next-line no-prototype-builtins
        if (mapViewGroups.jimuMapViews.hasOwnProperty(jimuMapViewsFirst) && mapViewGroups.jimuMapViews.hasOwnProperty(jimuMapViewsSecond)) {
          updatedMapViewGroups = mapViewGroups
          mapWidgetInstance = updatedMapViewGroups.mapWidgetInstance
        } else {
          this._mapViewGroupLoad = setTimeout(() => {
            this.getAvailableDataSources(this.props.useMapWidgetIds)
          }, 50)
        }
      }
    }
    return [updatedMapViewGroups, mapWidgetInstance]
  }

  getAvailableDataSources = (useMapWidgetIds) => {
    let groundElevationLayerUrl = ''
    this.dataSourceOptions = []
    this.groundData = []
    let newConfig = this.props.config.configInfo[this.state.activeDataSource] ? this.props.config : this.props.config.set('configInfo', {})
    //Let framework know which data source current widget is using and which data source current widget is outputing.
    const outputDsJsons: DataSourceJson[] = [this.getInitOutDataSource()]
    if (this._mapViewGroupLoad) {
      clearInterval(this._mapViewGroupLoad)
    }

    const getMapViewGroup = this.getMapViewGroupInstance(useMapWidgetIds)
    const updatedMapViewGroups = getMapViewGroup[0]

    if (updatedMapViewGroups && updatedMapViewGroups.jimuMapViews) {
      if (this._mapLoadedTimer) {
        clearInterval(this._mapLoadedTimer)
      }
      for (const id in updatedMapViewGroups.jimuMapViews) {
        this.mapView = updatedMapViewGroups.jimuMapViews[id]
      }
      waitForChildDataSourcesReady(this.mapView).finally(() => {
        this.setState({
          showLoadingIndicator: false
        })
        for (const id in updatedMapViewGroups.jimuMapViews) {
          if (updatedMapViewGroups.jimuMapViews[id].dataSourceId) {
            const availableGroundLayers = updatedMapViewGroups.jimuMapViews[id].view.map.ground.layers

            let isGroundLayer: boolean = false
            if (availableGroundLayers.length > 0) {
              isGroundLayer = true
            }
            if (availableGroundLayers.length > 0) { // Use map ground elevation layer
              const groundLayer: any = updatedMapViewGroups.jimuMapViews[id].view.map.ground.layers
              groundElevationLayerUrl = groundLayer?.items[0]?.url
            }
            this.groundData.push({
              dataSourceId: updatedMapViewGroups.jimuMapViews[id].dataSourceId,
              isGroundElevationLayerExists: isGroundLayer,
              groundElevationLayerUrl: groundElevationLayerUrl
            })
            newConfig = this.getConfigForSelectedDs(updatedMapViewGroups.jimuMapViews[id].dataSourceId, newConfig, isGroundLayer, groundElevationLayerUrl)
            newConfig = this.checkBackwardForAdvanceOption(newConfig)
            if (updatedMapViewGroups.jimuMapViews[id].isActive || updatedMapViewGroups.jimuMapViews[id].isActive === undefined) {
              newConfig = newConfig.set('activeDataSource', updatedMapViewGroups.jimuMapViews[id].dataSourceId)
              this.setState({
                activeDataSource: updatedMapViewGroups.jimuMapViews[id].dataSourceId
              })
            }

            const addedDsOption = this.canAddDataSource(updatedMapViewGroups.jimuMapViews[id].dataSourceId)
            if (addedDsOption) {
              this.dataSourceOptions.push({
                label: this.getDataSourceLabel(updatedMapViewGroups.jimuMapViews[id].dataSourceId),
                value: updatedMapViewGroups.jimuMapViews[id].dataSourceId
              })
            }
          }
        }

        //if default datasource are configured
        if (this.dataSourceOptions.length === 0) {
          if (updatedMapViewGroups && updatedMapViewGroups.jimuMapViews) {
            for (const id in updatedMapViewGroups.jimuMapViews) {
              let isGroundLayer: boolean = false
              if (updatedMapViewGroups.jimuMapViews[id].view.map.ground.layers.length > 0) {
                const groundLayer: any = updatedMapViewGroups.jimuMapViews[id].view.map.ground.layers
                groundElevationLayerUrl = groundLayer?.items[0]?.url
                isGroundLayer = true
              }
              newConfig = newConfig.set('activeDataSource', 'default')
              this.groundData.push({
                dataSourceId: 'default',
                isGroundElevationLayerExists: isGroundLayer,
                groundElevationLayerUrl: groundElevationLayerUrl
              })
              this.setState({
                activeDataSource: 'default'
              })
              newConfig = this.getConfigForSelectedDs('default', newConfig, isGroundLayer, groundElevationLayerUrl)
            }
          }
        }
        newConfig = this.updateConfigAsPerNewWebMap(newConfig)
        const settings: any = {
          id: this.props.id,
          useMapWidgetIds: useMapWidgetIds?.length > 0 ? useMapWidgetIds : null,
          config: newConfig,
          useDataSources: this.dataSourceOptions.length === 0 ? [] : getUseDataSourcesForAllDs(newConfig.configInfo)
        }
        if (useMapWidgetIds?.length === 0) {
          settings.useDataSources = Immutable([])
          this.props.onSettingChange(settings, [])
        } else {
          this.props.onSettingChange(settings, outputDsJsons)
        }
      })
    } else {
      this._mapLoadedTimer = setTimeout(() => {
        this.getAvailableDataSources(useMapWidgetIds)
      }, 50)
    }
  }

  /**
   * Avoid duplicate addition of datasources in map settings
   * @param dataSourceId data source id
   * @param dataSourceOptions datasources to be added
   * @returns returns whether to add datsource
   */
  canAddDataSource = (dataSourceId: string): boolean => {
    let isAddDs: boolean = true

    // eslint-disable-next-line
    this.dataSourceOptions.some((dsOption) => {
      if (dsOption.value === dataSourceId) {
        isAddDs = false
      }
    })
    return isAddDs
  }

  checkBackwardForAdvanceOption = (newConfig) => {
    let newUpdatedConfig
    //For backward compatibility for advance option
    //If advance option is off make the ground elevation option enabled
    //If advance option is on make the customize option enabled
    //and delete the advanceOPtion Key so that the config will not be in backward mode
    // eslint-disable-next-line no-prototype-builtins
    if (newConfig?.configInfo?.[this.state.activeDataSource] && newConfig?.configInfo?.[this.state.activeDataSource].hasOwnProperty('advanceOptions')) {
      newUpdatedConfig = newConfig.setIn(['configInfo', this.state.activeDataSource, 'profileSettings', 'isProfileSettingsEnabled'], true)
      //if in backward advance option is enabled then it is a customized else only ground layer will be shown
      const isCustomizeOptionEnabled = newConfig?.configInfo?.[this.state.activeDataSource]?.advanceOptions
      newUpdatedConfig = newUpdatedConfig.setIn(['configInfo', this.state.activeDataSource, 'profileSettings', 'isCustomizeOptionEnabled'], isCustomizeOptionEnabled)
      //once add new key remove the advanceOptions key as it is no longer backward config
      const updatedConfig = newUpdatedConfig.configInfo[this.state.activeDataSource]
      const copyOfUpdatedConfig = { ...updatedConfig }
      delete copyOfUpdatedConfig.advanceOptions
      newUpdatedConfig = newConfig.setIn(['configInfo', this.state.activeDataSource], copyOfUpdatedConfig)
      return newUpdatedConfig
    }
    return newConfig
  }

  updateAssetOrProfileLayersSettings = (configKey: string, dataSource: string, layerIndex: number,
    dataObj: any, data: any, isLayerAddOrRemove: boolean) => {
    let settingsObj, currentItem, configItems
    //If layer added or removed from the layer list then update the config
    if (isLayerAddOrRemove && layerIndex === null) {
      this.props.onSettingChange({
        id: this.props.id,
        config: this.props.config.setIn(['configInfo', dataSource, configKey, 'layers'], Immutable(data))
      })
    } else if (layerIndex !== null) {
      //If layer index is specified, update the configuration for specified index
      currentItem = this.props.config.configInfo[dataSource][configKey].layers[layerIndex].asMutable({ deep: true })
      if (dataObj.childKey) {
        currentItem[dataObj.parentKey][dataObj.childKey] = dataObj.value
      } else {
        currentItem[dataObj.parentKey] = dataObj.value
      }
      configItems = this.props.config.configInfo[dataSource][configKey].layers.asMutable({ deep: true })
      configItems.splice(layerIndex, 1, currentItem)
      settingsObj = Immutable(configItems)
      //update the settings by removing duplicates layers

      const updatedSettingObj = settingsObj.filter((ele, ind) =>
        ind === settingsObj.findIndex(elem =>
          elem.layerId === ele.layerId))

      this.props.onSettingChange({
        id: this.props.id,
        config: this.props.config.setIn(['configInfo', dataSource, configKey, 'layers'], updatedSettingObj)
      })
    }
    setTimeout(() => {
      const useDataSourceInfo = getUseDataSourcesForAllDs(this.props.config.configInfo)
      this.props.onSettingChange({
        id: this.props.id,
        useDataSources: useDataSourceInfo
      })
    }, 100)
  }

  /**
  Show data source settings in sidepopper
  */
  showDsPanel = (dataSourceId: string) => {
    this.setState({
      activeDataSource: dataSourceId,
      isProfileChartSettingsOpen: false,
      showLayersSettings: false
    }, () => {
      this.setState({
        showLayersSettings: true
      })
    })
  }

  onToggleProfileChartSettings = () => {
    this.setState({
      isProfileChartSettingsOpen: !this.state.isProfileChartSettingsOpen
    })
  }

  handleProfileRendering = (value: boolean) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['configInfo', this.state.activeDataSource, 'profileSettings', 'isCustomizeOptionEnabled'], value)
    })
  }

  profileSettingsChange = (evt: any) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['configInfo', this.state.activeDataSource, 'profileSettings', 'isProfileSettingsEnabled'], evt.target.checked)
    })
  }

  assetSettingsChange = (evt: any) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['configInfo', this.state.activeDataSource, 'assetSettings', 'isAssetSettingsEnabled'], evt.target.checked)
    })
  }

  updateAssetBufferSettings = (property: string, value: string | number | boolean | any) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['configInfo', this.state.activeDataSource, 'assetSettings', 'assetIntersectingBuffer', property], value)
    })
  }

  updateProfileChartSettings = (property: string, value: any) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['configInfo', this.state.activeDataSource, 'profileChartSettings', property], value)
    })
  }

  updateGeneralSettings = (property: string, value: any) => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['generalSettings', property], value)
    })
  }

  render () {
    return (
      <div css={getStyle(this.props.theme)} className='h-100'>
        <div className={'widget-setting-elevation-profile'}>
          <SettingSection className={classNames('map-selector-section', { 'border-0': this.state.isNoMapSelected })} title={this.nls('sourceLabel')}>
            <SettingRow>
              <Label tabIndex={0} aria-label={this.nls('selectMapWidget')} title={this.nls('selectMapWidget')}
                className='w-100 d-flex'>
                <div className='text-truncate flex-grow-1 title3 hint-default'>
                  {this.nls('selectMapWidget')}
                </div>
              </Label>
            </SettingRow>
            <SettingRow>
              <MapWidgetSelector onSelect={this.onMapWidgetSelected.bind(this)} useMapWidgetIds={this.props.useMapWidgetIds} />
            </SettingRow>
          </SettingSection>

          {/* no map tips */}
          {this.state.isNoMapSelected &&
            <div className='d-flex placeholder-container justify-content-center align-items-center'>
              <div className='d-flex text-center placeholder justify-content-center align-items-center '>
                <ClickOutlined size={48} className='d-flex icon mb-2' />
                <p className='hint'>{this.nls('selectMapHint')}</p>
              </div>
            </div>}

          {this.props.useMapWidgetIds && this.props.useMapWidgetIds.length > 0 && this.state.mapWidgetExists &&
            <div>
              <SettingSection>
                <SettingRow>
                  <Label tabIndex={0} aria-label={this.nls('dataConfigLabel')} title={this.nls('dataConfigLabel')}
                    className='w-100 d-flex' style={{ maxWidth: '88%' }}>
                    <div className='text-truncate flex-grow-1 color-label title2 hint-paper'>
                      {this.nls('dataConfigLabel')}
                    </div>
                  </Label>
                </SettingRow>

                <SettingRow>
                  <Label tabIndex={0} aria-label={this.nls('dataConfigTooltip')} className='w-100 d-flex'>
                    <div className='flex-grow-1 text-break mapSettingsHint'>
                      {this.nls('dataConfigTooltip')}
                    </div>
                  </Label>
                </SettingRow>

                <SettingRow>
                  {this.state.showLoadingIndicator &&
                    <Loading type={LoadingType.Secondary} />
                  }
                  {!this.state.showLoadingIndicator && this.props.config.configInfo[this.state.activeDataSource] &&
                    <div className='w-100'>
                      <MultipleJimuMapConfig
                        mapWidgetId={this.props.useMapWidgetIds?.[0]}
                        onClick={this.showDsPanel}
                        showDefaultMapWhenEmpty
                        sidePopperContent={
                          <React.Fragment>
                            {this.state.activeDataSource && this.props.config.configInfo[this.state.activeDataSource] &&
                              <div className="w-100 h-100" css={getStyleForLI(this.props.theme)}>
                                <div className='setting-container'>
                                  <SettingSection>
                                    <CollapsablePanel
                                      label={this.nls('profileChart')}
                                      aria-label={this.nls('profileChart')}
                                      isOpen={this.state.isProfileChartSettingsOpen}
                                      onRequestOpen={() => { this.onToggleProfileChartSettings() }}
                                      onRequestClose={() => { this.onToggleProfileChartSettings() }}>
                                      <SettingRow flow='wrap'>
                                        <ProfileChartSettings
                                          intl={this.props.intl}
                                          theme={this.props.theme}
                                          currentDs={this.state.activeDataSource}
                                          config={this.props.config.configInfo[this.state.activeDataSource].profileChartSettings}
                                          groundLayerInfo={this.groundData}
                                          isRTL={this.isRTL}
                                          onProfileChartSettingsUpdated={this.updateProfileChartSettings}
                                        />
                                      </SettingRow>
                                    </CollapsablePanel>
                                  </SettingSection>

                                  <SettingSection>
                                    <React.Fragment>
                                      <SettingRow>
                                        <Label className='pr-2 w-100 d-flex'>
                                          <div className='flex-grow-1 text-break title2 text-paper'>
                                            {this.nls('profileSettingsLabel')}
                                          </div>
                                        </Label>
                                        <Switch role={'switch'} aria-label={this.nls('profileSettingsLabel')} title={this.nls('profileSettingsLabel')}
                                          checked={this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isProfileSettingsEnabled}
                                          aria-expanded={this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isProfileSettingsEnabled}
                                          onChange={this.profileSettingsChange} />
                                      </SettingRow>
                                      {this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isProfileSettingsEnabled &&
                                        <React.Fragment>
                                          {this.availableLineLayers.length === 0 &&
                                            <SettingRow>
                                              <Alert tabIndex={0} className={'warningMsg'}
                                                onClose={function noRefCheck () { }}
                                                open={true}
                                                text={this.nls('noLineLayersMessage')}
                                                type={'warning'}
                                              />
                                            </SettingRow>
                                          }
                                          <SettingRow label={this.nls('profileRendering')}>
                                            <Tooltip role={'tooltip'} tabIndex={0} aria-label={this.nls('profileRenderingTooltip')}
                                              title={this.nls('profileRenderingTooltip')} showArrow placement='top'>
                                              <div className='ml-2 d-inline color-label'>
                                                <Icon size={14} icon={epConfigIcon.infoIcon} />
                                              </div>
                                            </Tooltip>
                                          </SettingRow>

                                          <SettingRow flow={'wrap'}>
                                            <Label className='m-0 color-label' centric>
                                              <Radio role={'radio'} aria-label={this.nls('groundElevation')}
                                                className={'cursor-pointer'}
                                                value={'groundElevation'}
                                                onChange={() => { this.handleProfileRendering(false) }}
                                                checked={!this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isCustomizeOptionEnabled} />
                                              <div tabIndex={0} className='ml-1 text-break cursor-pointer' onClick={() => { this.handleProfileRendering(true) }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                    this.handleProfileRendering(false)
                                                  }
                                                }}>
                                                {this.nls('groundElevation')}
                                              </div>
                                            </Label>
                                          </SettingRow>

                                          {this.availableLineLayers.length > 0 &&
                                            !this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isCustomizeOptionEnabled &&
                                            <SettingRow>
                                              <Label tabIndex={0} aria-label={this.nls('groundElevationHint')} className='w-100 d-flex'>
                                                <div style={{ fontStyle: 'italic' }} className='flex-grow-1 text-break title3 hint-default'>
                                                  {this.nls('groundElevationHint')}
                                                </div>
                                              </Label>
                                            </SettingRow>
                                          }

                                          <SettingRow flow={'wrap'}>
                                            <Label className='m-0 color-label' centric>
                                              <Radio role={'radio'} aria-label={this.nls('customizeSelectableLayersLabel')}
                                                className={'cursor-pointer'}
                                                value={'customizeSelectableLayersLabel'}
                                                onChange={() => { this.handleProfileRendering(true) }}
                                                checked={this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isCustomizeOptionEnabled} />
                                              <div tabIndex={0} className='ml-1 text-break cursor-pointer' onClick={() => { this.handleProfileRendering(false) }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                    this.handleProfileRendering(true)
                                                  }
                                                }}>
                                                {this.nls('customizeSelectableLayersLabel')}
                                              </div>
                                            </Label>
                                          </SettingRow>
                                          {this.props.config.configInfo[this.state.activeDataSource]?.profileSettings.isCustomizeOptionEnabled &&
                                            this.state.showLayersSettings &&
                                            <SettingRow flow='wrap'>
                                              <ProfileSetting
                                                widgetId={this.props.widgetId}
                                                intl={this.props.intl}
                                                theme={this.props.theme}
                                                activeDsConfig={this.props.config.configInfo[this.state.activeDataSource]}
                                                config={this.props.config.configInfo[this.state.activeDataSource].profileSettings}
                                                onProfileSettingsUpdated={this.updateAssetOrProfileLayersSettings}
                                                activeDataSource={this.state.activeDataSource}
                                                mapWidgetId={this.props.useMapWidgetIds?.[0]}
                                              />
                                            </SettingRow>
                                          }
                                        </React.Fragment>
                                      }
                                    </React.Fragment>
                                  </SettingSection>

                                  <SettingSection>
                                    <React.Fragment>
                                      <SettingRow>
                                        <Label className='pr-2 w-100 d-flex'>
                                          <div className='flex-grow-1 text-break title2 text-paper'>
                                            {this.nls('assetSettingsLabel')}
                                          </div>
                                        </Label>
                                        <Switch role={'switch'} aria-label={this.nls('assetSettingsLabel')} title={this.nls('assetSettingsLabel')}
                                          checked={this.props.config.configInfo[this.state.activeDataSource]?.assetSettings?.isAssetSettingsEnabled || false}
                                          aria-expanded={this.props.config.configInfo[this.state.activeDataSource]?.assetSettings?.isAssetSettingsEnabled || false}
                                          onChange={this.assetSettingsChange} />
                                      </SettingRow>

                                      {this.props.config.configInfo[this.state.activeDataSource]?.assetSettings?.isAssetSettingsEnabled &&
                                        this.state.showLayersSettings &&
                                        <React.Fragment>
                                          {this.availableLineLayers.length === 0 && this.availablePointLayers.length === 0 &&
                                            <SettingRow>
                                              <Alert tabIndex={0} className={'warningMsg'}
                                                onClose={function noRefCheck () { }}
                                                open={true}
                                                text={this.nls('noLinePointLayersMessage')}
                                                type={'warning'}
                                              />
                                            </SettingRow>
                                          }

                                          <SettingRow flow='wrap'>
                                            <AssetSetting
                                              widgetId={this.props.widgetId}
                                              intl={this.props.intl}
                                              theme={this.props.theme}
                                              activeDsConfig={this.props.config.configInfo[this.state.activeDataSource]}
                                              config={this.props.config.configInfo[this.state.activeDataSource].assetSettings}
                                              activeDataSource={this.state.activeDataSource}
                                              mapWidgetId={this.props.useMapWidgetIds?.[0]}
                                              onAssetSettingsUpdated={this.updateAssetOrProfileLayersSettings}
                                              onAssetBufferSettingsUpdated={this.updateAssetBufferSettings}
                                            />
                                          </SettingRow>
                                        </React.Fragment>
                                      }
                                    </React.Fragment>
                                  </SettingSection>
                                </div>
                              </div>
                            }
                          </React.Fragment>
                        }
                      />
                    </div>
                  }
                </SettingRow>

                {this.state.activeDataSource === 'default' &&
                  <SettingRow>
                    <Alert tabIndex={0} className={'warningMsg'}
                      onClose={function noRefCheck () { }}
                      open={this.state.activeDataSource === 'default'}
                      text={this.nls('warningMsgIfDefaultDs')}
                      type={'warning'}
                    />
                  </SettingRow>
                }
              </SettingSection>
              {this.state.activeDataSource &&
                <SettingSection>
                  <SettingRow>
                    <Label tabIndex={0} aria-label={this.nls('generalSettingsLabel')} title={this.nls('generalSettingsLabel')}
                      className='w-100 d-flex' style={{ maxWidth: '88%' }}>
                      <div className='text-truncate flex-grow-1 color-label title2 hint-paper'>
                        {this.nls('generalSettingsLabel')}
                      </div>
                    </Label>
                  </SettingRow>
                  <SettingRow flow='wrap'>
                    <GeneralSettings
                      intl={this.props.intl}
                      theme={this.props.theme}
                      config={this.props.config.generalSettings}
                      onGeneralSettingsUpdated={this.updateGeneralSettings}
                    />
                  </SettingRow>
                </SettingSection>
              }
            </div>
          }
        </div>
      </div >
    )
  }
}
