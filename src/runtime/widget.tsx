/* eslint-disable no-prototype-builtins */
/** @jsx jsx */
import { React,useState, type AllWidgetProps, BaseWidget, jsx, classNames, getAppStore, WidgetState, AppMode, type IMState, type DataRecord, DataSourceManager, DataSourceStatus, type FeatureLayerQueryParams, type QueriableDataSource, type DataSource, geometryUtils, DataSourceSelectionMode, type IMDataSourceInfo, UrlManager, urlUtils, DataSourceComponent } from 'jimu-core'
import {
  WidgetPlaceholder, Card, CardBody, Button, Icon,Checkbox,Label,
  defaultMessages as jimuUIDefaultMessages,
  Loading,
  LoadingType
} from 'jimu-ui'
import { type IMConfig, ButtonTriggerType, type AssetBufferIntersection, type LayerIntersectionInfo, type IntersectionResult } from '../config'
import { JimuMapViewComponent, type JimuMapView, type FeatureLayerDataSource, type FeatureDataRecord } from 'jimu-arcgis'
import { getStyle } from './lib/style'
import ResultPane from './components/results-pane'
import defaultMessages from './translations/default'
import { getRuntimeIcon, epStatistics, defaultElevationLayer, ElevationProfileErrorState, unitOptions, ElevationProfileStatisticsName, getReverseStatsOnFlip } from './constants'
import { getAllLayersFromDataSource, defaultSelectedUnits, getPortalSelfElevationUnits, getPortalSelfLinearUnits } from '../common/utils'
import SketchViewModel from 'esri/widgets/Sketch/SketchViewModel'
import Graphic from 'esri/Graphic'
import GraphicsLayer from 'esri/layers/GraphicsLayer'
import  Point from 'esri/geometry/Point'
import Extent from 'esri/geometry/Extent'
import geometryEngine from 'esri/geometry/geometryEngine'
import ElevationProfileViewModel from 'esri/widgets/ElevationProfile/ElevationProfileViewModel'
import reactiveUtils from 'esri/core/reactiveUtils'
import ElevationLayer from 'esri/layers/ElevationLayer'
import jsonUtils from 'esri/symbols/support/jsonUtils'
import Polyline from 'esri/geometry/Polyline'
import SpatialReference from 'esri/geometry/SpatialReference'
import unitUtils from 'esri/core/unitUtils'
import Color from 'esri/Color'
import FeatureLayer from 'esri/layers/FeatureLayer'
import { convertSingle } from '../common/unit-conversion'
import type Geometry from 'esri/geometry/Geometry'
import promiseUtils from 'esri/core/promiseUtils'
import { versionManager } from '../version-manager'
import Draw from 'esri/views/draw/Draw'
const { epIcon } = getRuntimeIcon()

const defaultPointSymbol = {
  style: 'esriSMSCircle',
  color: [0, 0, 128, 128],
  name: 'Circle',
  outline: {
    color: [0, 0, 128, 255],
    width: 1
  },
  type: 'esriSMS',
  size: 18
}

interface ExtraProps {
  appMode: AppMode
  selectedFeatureRecords: DataRecord[]
  currentPageId: string
}

interface IState {
  initialStage: boolean
  resultStage: boolean
  selectModeActive: boolean
  addToSelectionTool: boolean
  drawModeActive: boolean
  onDrawingComplete: boolean
  currentDatasource: string
  currentSketchVM: SketchViewModel
  jimuMapView: JimuMapView
  startChartRendering: boolean
  groundColor: string
  graphicsHighlightColor: string
  chartColorRender: string
  customElevationLayer: boolean
  elevationLayer: string
  profileResult: any
  selectedLinearUnit: string
  selectedElevationUnit: string
  noFeaturesError: boolean
  profileLineLayers: any
  lineLayersNotFound: boolean
  viewModelErrorState: boolean
  profileErrorMsg: string
  noGraphicAfterFirstSelection: boolean
  onWidgetLoadShowLoadingIndicator: boolean
  loadingIndicator: boolean
  nextPossibleloadingIndicator: boolean
  selectedFeatureRecord: any
  intersectionResult: LayerIntersectionInfo[]
  chartDataUpdateTime: number
  isMapLoaded: boolean
  layersLoaded: boolean
  dsToGetSelectedOnLoad: string
  polecheckboxChanged:boolean
}

export default class Widget extends BaseWidget<AllWidgetProps<IMConfig> & ExtraProps, IState> {
  private drawingLayer: GraphicsLayer
  private intersectionHighlightLayer: GraphicsLayer
  private nextPossibleSelectionLayer: GraphicsLayer
  private bufferLayer: GraphicsLayer
  private mapView: JimuMapView
  private selectedUnit: [string, string]
  private _defaultViewModel: ElevationProfileViewModel
  private selectableLayersAtRuntime: string[]
  private intersectingLayersAtRuntime: string[]
  private isSelectableLayersChangedAtRuntime: boolean
  private readonly defaultConfig
  private newFeatureSelection: boolean
  private activeCurrentDs: string
  private selectedBufferValues: AssetBufferIntersection
  private bufferGraphics: Graphic
  private resultsAfterIntersectionTimeout = null
  private _abortController: AbortController
  private _drawTool: Draw
  private poleDrawingLayer:GraphicsLayer
  private poleactiveDrawingLayer:GraphicsLayer
  private poledrawAction:any
  static versionManager = versionManager
  static mapExtraStateProps = (state: IMState,
    props: AllWidgetProps<IMConfig>): ExtraProps => {
    return {
      appMode: state.appRuntimeInfo?.appMode,
      selectedFeatureRecords: props?.mutableStateProps?.selectedFeatureRecords,
      currentPageId: state.appRuntimeInfo?.currentPageId
    }
  }

  constructor (props) {
    super(props)
    this.defaultConfig = this.createDefaultConfigForDataSource()
    this.newFeatureSelection = false
    //create all graphic layers for drawing, highlighting etc.
    this.createDrawingLayers()
    this.activeCurrentDs = 'default'
    this.selectableLayersAtRuntime = []
    this.intersectingLayersAtRuntime = []
    this.isSelectableLayersChangedAtRuntime = false
    this._defaultViewModel = null
    this.selectedBufferValues = null
    const activeDsConfig = this.props.config.configInfo[this.props.config.activeDataSource]
    this.selectedUnit = defaultSelectedUnits(activeDsConfig, this.props.portalSelf)
    this.bufferGraphics = null
    this._drawTool=null
    //this.poleDrawingLayer=null
    this.poledrawAction=null
   // this.poleactiveDrawingLayer=null
    this.state = {
      initialStage: true,
      resultStage: false,
      selectModeActive: this.props.config.generalSettings?.isSelectToolActive,
      addToSelectionTool: false,
      drawModeActive: this.props.config.generalSettings?.isDrawToolActive,
      onDrawingComplete: false,
      currentDatasource: this.props.config.activeDataSource,
      currentSketchVM: null,
      jimuMapView: null,
      startChartRendering: false,
      groundColor: activeDsConfig?.profileChartSettings?.groundColor,
      graphicsHighlightColor: activeDsConfig?.profileChartSettings?.graphicsHighlightColor,
      chartColorRender: '',
      customElevationLayer: activeDsConfig?.profileChartSettings?.isCustomElevationLayer,
      elevationLayer: activeDsConfig?.profileChartSettings?.elevationLayerURL,
      profileResult: null,
      selectedLinearUnit: this.selectedUnit[1],
      selectedElevationUnit: this.selectedUnit[0],
      noFeaturesError: false,
      profileLineLayers: [],
      lineLayersNotFound: !((this.canShowSelectAndDrawOptions(activeDsConfig) &&
       this.canShowProfilingForBackward(activeDsConfig) && activeDsConfig.profileSettings.layers.length !== 0) ||
        (this.canShowSelectAndDrawOptions(activeDsConfig) && !this.canShowProfilingForBackward(activeDsConfig))),
      viewModelErrorState: false,
      profileErrorMsg: '',
      noGraphicAfterFirstSelection: false,
      onWidgetLoadShowLoadingIndicator: true,
      loadingIndicator: false,
      nextPossibleloadingIndicator: false,
      selectedFeatureRecord: null,
      intersectionResult: null,
      chartDataUpdateTime: 0,
      isMapLoaded: false,
      layersLoaded: false,
      dsToGetSelectedOnLoad: '',
      polecheckboxChanged:true
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

  createDrawingLayers = () => {
    //create new graphicsLayer to draw lines
    this.drawingLayer = new GraphicsLayer({
      listMode: 'hide',
      effect: 'bloom(0.8, 1px, 0)'
    })

    //create new graphicsLayer to draw pole lines
    this.poleDrawingLayer = new GraphicsLayer({
      listMode: 'hide',
      effect: 'bloom(0.8, 1px, 0)'
    })
    //create new graphicsLayer to draw pole lines
    this.poleactiveDrawingLayer = new GraphicsLayer({
      listMode: 'hide',
      effect: 'bloom(0.8, 1px, 0)'
    })
    

    //create new graphicsLayer to show next possible selections
    this.nextPossibleSelectionLayer = new GraphicsLayer({
      listMode: 'hide',
      effect: 'bloom(0.8, 0px, 1%)'
    })

    //create new graphicsLayer to show buffer graphics
    this.bufferLayer = new GraphicsLayer({
      listMode: 'hide'
    })

    //create new graphicsLayer to show highlight intersecting features
    this.intersectionHighlightLayer = new GraphicsLayer({
      listMode: 'hide',
      effect: 'bloom(0.8, 1px, 0)'
    })
  }

  componentDidMount = () => {
    this.setState({
      chartColorRender: this.state.groundColor,
      noFeaturesError: false,
      viewModelErrorState: false
    })
  }

  //wait for all the jimu layers and dataSource loaded
  waitForChildDataSourcesReady = async (mapView: JimuMapView): Promise<DataSource> => {
    await mapView?.whenAllJimuLayerViewLoaded()
    const ds = DataSourceManager.getInstance().getDataSource(mapView?.dataSourceId)
    if (ds?.isDataSourceSet && !ds.areChildDataSourcesCreated()) {
      await ds.childDataSourcesReady()
    }
    return Promise.resolve(ds)
  }
  addPolelineGraphic = (event:any) => {
  
    this.poleDrawingLayer.removeAll();

    const polyline = new Polyline({
      spatialReference: this.mapView.view.spatialReference,
      paths: event.vertices,
    });

    var graphic = new Graphic({
      geometry: polyline,
      symbol: {
        type: "simple-line",
        color: this.selectedBufferValues.bufferSymbol.outline.color,
        width: 2,
        style: "solid" // Red Dotted Line
      },
    });
    const color = new Color(this.state.graphicsHighlightColor ? this.state.graphicsHighlightColor : '#00ffff')
    const rgbaColor = color.toRgba()
   var polylineSymbol= {
    type: "simple-line", // autocasts as SimpleLineSymbol()
    color: [226, 119, 40],
    width: 4
  };
//create new graphic with the newly selected geometry
const polylineGraphic = new Graphic({
  geometry: polyline,
  symbol: polylineSymbol
})
   this.poleDrawingLayer.graphics.add(graphic);
    if(event.type=="draw-complete"){
      this.poledrawAction.destroy()
      //graphic.geometry=this.getnearbyPolespolyline(polyline)
     this._defaultViewModel.input=polylineGraphic
     this.setState({
      loadingIndicator: true,
      onDrawingComplete: true
    })
    }
      
  }
  setnearbyPolespolyline=()=>{
    if(!this._defaultViewModel)
      return
    if(!this._defaultViewModel.input)
      return
  let  polyline=this._defaultViewModel.input.geometry
    const poleData: [number, number, string][] = [];
    const polyPaths: [number, number][] = [];
 if(this.state.intersectionResult && this.state.intersectionResult.length>0){
      let layerfeatures=this.state.intersectionResult[0].intersectionResult
      if(layerfeatures.length==0)
        return
      var features=[];
        for (let i = 0; i < layerfeatures.length; i++) {
          features.push(layerfeatures[i].intersectingFeature);
        }
        for (const path of polyline.paths[0]) {
          let closestPole = null;
          let minDist = this.mapView.view.width / (15 + ((50 - this.selectedBufferValues.bufferDistance) + 25))
          const pt = new Point({ x: path[0], y: path[1] });
  
          for (const feature of features) {
            const poleGeo = feature.geometry as Point;
            const dist = Math.hypot(pt.x - poleGeo.x, pt.y - poleGeo.y);
  
            if (dist < minDist) {
              minDist = dist;
              closestPole = feature;
            }
          }
  
          if (closestPole) {
            polyPaths.push([closestPole.geometry.x, closestPole.geometry.y]);
            poleData.push([closestPole.geometry.x, closestPole.geometry.y, closestPole.attributes.FACILITYID]);
          } else {
            polyPaths.push([pt.x, pt.y]);
            poleData.push([pt.x, pt.y, '']);
          }
        }
        polyline = new Polyline({ paths: [polyPaths], spatialReference: this.mapView.view.spatialReference });
         const symbol ={
              type: "simple-line", 
              style: 'dash',
              color: new Color([255, 0, 0]),
              width: 1
            };
            //create new graphic with the newly selected geometry
const polylineGraphic = new Graphic({
  geometry: polyline,
  symbol: symbol
})
            this.poleactiveDrawingLayer.removeAll();
            this.poleactiveDrawingLayer.add(polylineGraphic);
          // this._defaultViewModel.input.geometry=polyline
             if(!geometryEngine.equals(this._defaultViewModel?.input?.geometry, polyline)){
              //this._defaultViewModel.input.symbol=symbol
              this._defaultViewModel.input.geometry=polyline
             }
              
      }
      //return polyline
  }
  //create data source by id for only configured selectable and intersecting layers and wait for only those layers to load
  loadConfiguredDataSources = (currentDataSourceId: string): Array<Promise<DataSource>> => {
    const mapDs = DataSourceManager.getInstance().getDataSource(currentDataSourceId)
    const createdDs = []
    const uniqueUsedDsId = []
    this.props.config?.configInfo?.[currentDataSourceId]?.profileSettings?.layers?.forEach(async (inidividualLayer) => {
      !uniqueUsedDsId.includes(inidividualLayer.layerId) && uniqueUsedDsId.push(inidividualLayer.layerId)
    })
    this.props.config?.configInfo?.[currentDataSourceId]?.assetSettings?.layers?.forEach(async (inidividualLayer) => {
      !uniqueUsedDsId.includes(inidividualLayer.layerId) && uniqueUsedDsId.push(inidividualLayer.layerId)
    })
    uniqueUsedDsId.forEach((dsId) => {
      createdDs.push(new Promise((resolve, reject) => {
        try {
          mapDs?.createDataSourceById(dsId).then((ds) => {
            resolve(ds)
          }, () => {
            resolve(null)
          })
        } catch {
          resolve(null)
        }
      }))
    })
    return createdDs
  }

  //Get selected feature record
  getSelectedFeatureRecords = (currentDs: string) => {
    let selectedFeatureRecord = []
    const allDataSources = getAllLayersFromDataSource(currentDs)
    allDataSources?.forEach(async (layer: FeatureLayerDataSource) => {
      await layer.ready()
      if (layer.getSelectedRecords().length > 0) {
        selectedFeatureRecord = layer.getSelectedRecords()
        let isFeatureValid = false
        const dsLayerId = selectedFeatureRecord?.[0]?.dataSource.getMainDataSource().id
        if (selectedFeatureRecord?.[0].feature) {
          this.getSelectableLayers(this.state.currentDatasource)
          if (selectedFeatureRecord?.[0].feature?.geometry?.type === 'polyline' && this.selectableLayersAtRuntime.includes(dsLayerId)) {
            isFeatureValid = true
          }
        }
        if (isFeatureValid) {
          //Show profile on app load if feature is preselected
          this.displayFeaturesResult(dsLayerId, [selectedFeatureRecord?.[0]?.feature])
          return true
        }
      }
    })
  }

  onDataSourceInfoChange = (info: IMDataSourceInfo) => {
    if (info?.selectedIds?.length) {
      let selectedFeatureRecord = []
      const dsLayer = DataSourceManager.getInstance().getDataSource(this.state.dsToGetSelectedOnLoad)
      selectedFeatureRecord = dsLayer.getSelectedRecords()
      //Show profile on app load if feature is preselected
      this.displayFeaturesResult(this.state.dsToGetSelectedOnLoad, [selectedFeatureRecord?.[0]?.feature])
      this.setState({
        dsToGetSelectedOnLoad: '' 
      })
    }
  }

  getSelectedFeatureOnLoad = () => {
    const urlManager = UrlManager.getInstance()
    const dsInfos = urlUtils.getDataSourceInfosFromUrlParmas(urlManager.getQueryObject(), urlManager.getHashObject())
    for (const dsLayerId in dsInfos) {
      if (this.selectableLayersAtRuntime.includes(dsLayerId)) {
        const selection = dsInfos[dsLayerId]?.selection as any
        if (selection?.ids?.length || selection?.queryParams?.geometry) {
          this.setState({
            dsToGetSelectedOnLoad: dsLayerId
          })
          break
        }
      }
    }
  }

  activeViewChangeHandler = async (jmv: JimuMapView) => {
    if (!(jmv && jmv.view)) {
      this.setState({
        initialStage: false,
        resultStage: false
      })
      return
    }
    this.mapView = jmv
    if (this.state.jimuMapView) {
      // we have a 'previous' map where we added the widget
      // (ex: case where two Maps in single Experience page and user is switching
      // between them in the dropdown) - we must destroy the old widget in this case.
      // destroy the sketch view modal if it was still not destroyed
      // this will resolve the cross origin issue with react
      if (this.state.currentSketchVM && !this.state.currentSketchVM.destroyed) {
        this.state.currentSketchVM.destroy()
      }
      //Once the data source is changed, clear the chart and map graphics and set widget to initial stage
      this.clearAll()
      this.setState({
        initialStage: true,
        resultStage: false,
        drawModeActive: this.props.config.generalSettings?.isDrawToolActive,
        selectModeActive: this.props.config.generalSettings?.isSelectToolActive
      })
      //destroy prev drawing layers and create new for changed map view
      this.destroyDrawingLayers()
      this.createDrawingLayers()
    }

    this.setState({
      onWidgetLoadShowLoadingIndicator: true,
      layersLoaded: false
    })
    try {
      if (this.props.config?.configInfo?.[jmv?.dataSourceId]?.profileSettings.isCustomizeOptionEnabled) {
        await Promise.all(this.loadConfiguredDataSources(jmv.dataSourceId))
      } else {
        await this.waitForChildDataSourcesReady(this.mapView)
      }
    } catch (e) {
      console.error(e)
    }
    this.setState({
      onWidgetLoadShowLoadingIndicator: false,
      layersLoaded: true
    })
    if (jmv) {
      this.setState({
        jimuMapView: jmv
      }, () => {
        //If no configuration found for selected data source
        //create and use the default configuration
        //this will allow user to use the widget with basic draw tool
        if (jmv.dataSourceId === '') {
          this.setState({
            currentDatasource: 'default'
          }, () => {
            this.activeCurrentDs = this.state.currentDatasource
            //set default Units
            this.selectedUnit = defaultSelectedUnits(this.props.config.configInfo[this.state.currentDatasource], this.props.portalSelf)
            this.getSelectableLayers(this.state.currentDatasource)
          })
        } else if (this.state.jimuMapView.dataSourceId !== this.props.config.activeDataSource || !this.props.config.configInfo[this.props.config.activeDataSource]) {
          this.setState({
            currentDatasource: this.state.jimuMapView.dataSourceId
          }, () => {
            this.getSelectableLayers(this.state.currentDatasource)
          })
          this.checkLineLayerAvailableInDsAndConfig(this.state.jimuMapView.dataSourceId)
        } else if (this.props.config.activeDataSource &&
            this.props.config.configInfo[this.props.config.activeDataSource]) {
          let configDs = this.props.config.activeDataSource
          if (this.state.jimuMapView && this.state.jimuMapView.dataSourceId) {
            if (this.props.config.configInfo.hasOwnProperty(this.state.jimuMapView.dataSourceId)) {
              configDs = this.state.jimuMapView.dataSourceId
            } else {
              configDs = 'default'
            }
            this.setState({
              currentDatasource: configDs
            }, () => {
              this.activeCurrentDs = this.state.currentDatasource
              if (this.state.currentDatasource !== 'default') {
                this.checkLineLayerAvailableInDsAndConfig(this.state.currentDatasource)
              }
              this.setConfigForDataSources()
              this.getSelectableLayers(this.state.currentDatasource)
            })
          }
        }

        setTimeout(() => {
          const elevationInfo = {
            mode: this.state.jimuMapView.view.type === '3d' ? 'relative-to-ground' : 'on-the-ground',
            offset: null
          }
          this.drawingLayer.set('elevationInfo', elevationInfo)
          this.nextPossibleSelectionLayer.set('elevationInfo', elevationInfo)
          this.state.jimuMapView.view.map.addMany([this.poleactiveDrawingLayer,this.poleDrawingLayer,this.bufferLayer, this.nextPossibleSelectionLayer, this.drawingLayer, this.intersectionHighlightLayer])
          this.createApiWidget(jmv)
          this.createEpViewModel(jmv)
          //check the widget state whether open/close in live view
          const currentWidgetState = getAppStore().getState().widgetsRuntimeInfo[this.props.id].state
          const loadSelectOrDrawTool = true
          if (loadSelectOrDrawTool && (currentWidgetState === WidgetState.Opened || !currentWidgetState)) {
            this.loadSelectDrawToolOnLoad(this.activeCurrentDs)
          }
          this.getSelectedFeatureOnLoad()
        }, 100)
      })
    }
  }

  loadSelectDrawToolOnLoad = (activeCurrentDs) => {
    //on widget load activate draw/select tool if it is enabled in config
    if (activeCurrentDs === 'default') {
      if (this.state.drawModeActive) {
        this.manageActiveDrawSelect()
      }
    } else if (this.state.drawModeActive || this.state.selectModeActive) {
      if (this.state.lineLayersNotFound && this.state.selectModeActive) {
        return
      }
      this.manageActiveDrawSelect()
    } else {
      this.setState({
        resultStage: false,
        initialStage: true
      })
    }
  }

  manageActiveDrawSelect = () => {
    this.setState({
      resultStage: true,
      initialStage: false
    }, () => {
      this.clearAll(true)
      this._displayDefaultCursor()
      this.activateDrawOrSelectTool()
    })
  }

  checkLineLayerAvailableInDsAndConfig = (activeDs: string) => {
    const allLayerSources: DataSource[] = getAllLayersFromDataSource(activeDs)
    let noLineLayerFound: boolean = true
    allLayerSources?.forEach((layer: FeatureLayerDataSource) => {
      if (layer && layer.getLayerDefinition() && layer.getLayerDefinition().geometryType &&
        layer.getLayerDefinition().geometryType === 'esriGeometryPolyline') {
        noLineLayerFound = false
      }
    })
    if (activeDs && this.props.config.configInfo[activeDs]) {
      if (this.canShowSelectAndDrawOptions(this.props.config.configInfo[activeDs])) {
        if (this.canShowProfilingForBackward(this.props.config.configInfo[activeDs])) {
          if (this.props.config.configInfo[activeDs]?.profileSettings.layers.length === 0) {
            noLineLayerFound = true
          }
        }
      } else {
        noLineLayerFound = true
      }
    } else {
      noLineLayerFound = true
    }
    this.setState({
      lineLayersNotFound: noLineLayerFound
    })
  }

  setConfigForDataSources = () => {
    const configActiveDs = this.props.config.configInfo[this.state.currentDatasource]
    this.setState({
      groundColor: configActiveDs ? configActiveDs.profileChartSettings?.groundColor : this.defaultConfig.profileChartSettings.groundColor,
      graphicsHighlightColor: configActiveDs ? configActiveDs.profileChartSettings?.graphicsHighlightColor : this.defaultConfig.profileChartSettings.graphicsHighlightColor,
      chartColorRender: configActiveDs ? configActiveDs.profileChartSettings?.groundColor : this.defaultConfig.profileChartSettings.groundColor,
      customElevationLayer: configActiveDs ? configActiveDs.profileChartSettings?.isCustomElevationLayer : this.defaultConfig.profileChartSettings.isCustomElevationLayer,
      elevationLayer: configActiveDs ? configActiveDs.profileChartSettings?.elevationLayerURL : this.defaultConfig.profileChartSettings.elevationLayerURL,
      selectedLinearUnit: configActiveDs ? this.selectedUnit[1] : this.defaultConfig.profileChartSettings.linearUnit,
      selectedElevationUnit: configActiveDs ? this.selectedUnit[0] : this.defaultConfig.profileChartSettings.elevationUnit
    })
  }

  createDefaultConfigForDataSource = () => {
    let elevationUnit = ''
    let linearUnit = ''
    //Fetch and set the default units based on portal settings
    elevationUnit = getPortalSelfElevationUnits(this.props.portalSelf)
    linearUnit = getPortalSelfLinearUnits(this.props.portalSelf)
    //Populate the default settings
    return {
      profileChartSettings: {
        isCustomElevationLayer: true,
        elevationLayerURL: defaultElevationLayer,
        linearUnit: linearUnit,
        elevationUnit: elevationUnit,
        displayStatistics: true,
        selectedStatistics: epStatistics,
        groundColor: '#b54900',
        graphicsHighlightColor: '#b54900',
        showVolumetricObjLineInGraph: false,
        volumetricObjLineColor: '#cf4ccf',
        volumetricObjLabel: this.nls('volumetricObj')
      }
    }
  }

  //check for the advanced option in backward compatibility when customize option is enabled or ground elevation option disabled
  canShowProfilingForBackward = (activeDsConfigInfo) => {
    let showProfiling: boolean = false
    if (activeDsConfigInfo) {
      if ((activeDsConfigInfo?.hasOwnProperty('advanceOptions') ||
      (activeDsConfigInfo?.profileSettings?.hasOwnProperty('isProfileSettingsEnabled') &&
      activeDsConfigInfo?.profileSettings?.hasOwnProperty('isCustomizeOptionEnabled')))) {
        if (activeDsConfigInfo?.advanceOptions ||
          (activeDsConfigInfo?.profileSettings?.isProfileSettingsEnabled &&
            activeDsConfigInfo?.profileSettings?.isCustomizeOptionEnabled)) {
          showProfiling = true
        }
      }
    }
    return showProfiling
  }

  //check if the selectable layers options is enabled or disabled
  canShowSelectAndDrawOptions = (activeDsConfigInfo) => {
    let showSelectAndDrawingOption: boolean = true
    if (activeDsConfigInfo?.profileSettings?.hasOwnProperty('isProfileSettingsEnabled')) {
      showSelectAndDrawingOption = activeDsConfigInfo.profileSettings.isProfileSettingsEnabled
    }
    return showSelectAndDrawingOption
  }

  createApiWidget = (jmv: JimuMapView) => {
    // Create a new instance of sketchViewModel
    const sketchVM = new SketchViewModel({
      view: jmv ? jmv.view : null,
      layer: new GraphicsLayer(),
      updateOnGraphicClick: false,
      defaultCreateOptions: {
        mode: 'click',
        hasZ: jmv?.view?.type === '3d'
      },
      polylineSymbol: {
        type: 'simple-line',
        color: this.state.graphicsHighlightColor,
        width: 5
      },
      pointSymbol: jsonUtils.fromJSON(defaultPointSymbol) as any,
      defaultUpdateOptions: {
        toggleToolOnClick: false
      }
    })

    sketchVM.on('create', event => {
      if (event.state === 'start') {
        const polylineSymbol = {
          type: 'simple-line',
          color: this.state.graphicsHighlightColor,
          width: 5
        }
        this.state.currentSketchVM.set('polylineSymbol', polylineSymbol)
      } else if (event.state === 'complete') {
        this.setState({
          noFeaturesError: false
        })
        if (this.state.selectModeActive) {
          this.setState({
            loadingIndicator: true
          })
          const options = { returnAllFields: true, returnFullGeometry: true }
          jmv.selectFeaturesByGraphic(event.graphic, 'intersects', DataSourceSelectionMode.New, options).then((featuresByLayer) => {
            const jimuLayerViews = Object.values(this.state.jimuMapView.jimuLayerViews)
            const featureByLayer = {}
            for (let i = 0; i < jimuLayerViews.length; i++) {
              if (featuresByLayer[jimuLayerViews[i].id]?.length > 0) {
                const layerDsId = jimuLayerViews[i].getLayerDataSource().id
                featureByLayer[layerDsId] = featuresByLayer[jimuLayerViews[i].id]
              }
            }
            this.queryForNewSelection(featureByLayer, true)
          }, (e) => {
            const error = this.getErrorMsgState(ElevationProfileErrorState.UnknownError)
            this.setState({
              loadingIndicator: false,
              viewModelErrorState: error[0],
              profileErrorMsg: error[1]
            })
          })
        }
      }
    })

    this.setState({
      currentSketchVM: sketchVM
    })

    jmv?.view?.on('click', (event) => {
      const filterLayer = this.nextPossibleSelectionLayer
      if (this.state.addToSelectionTool) {
        //stopPropagation so that info window is not shown
        event.stopPropagation()
        jmv.view.hitTest(event).then((response) => {
          // check if a feature is returned from the next possible selection layer
          // do something with the result graphic
          if (response && response.results) {
            const graphicResults = response.results.filter(r => r.type === 'graphic') as __esri.GraphicHit[]
            const results = graphicResults.filter((result) => {
              return result.graphic.layer === filterLayer &&
                result.graphic.geometry.type === 'polyline'
            })
            if (results && results.length > 0) {
              //clear profile chart
              this.clearChart()
              this.newFeatureSelection = false
              //to remove the extra selection form map view, done by system while showing info-window of selected features
              this.mapView.clearSelectedFeatures()
              this.selectFeatureForProfiling(results[0].graphic)
            }
          }
        })
      }
    })
  }

  createEpViewModel = (jmv, volumetricObjectsChanged?: boolean) => {
    const profiles: any = []
    //if view model present then empty all the existing profiles and create new profiles
    if (this._defaultViewModel) {
      this._defaultViewModel.profiles = profiles
    }
    if (!this.state.customElevationLayer) {
      profiles.push({
        type: 'ground', // ground Profile
        color: this.state.groundColor
      })
    } else {
      profiles.push({
        // displays elevation values from a custom source
        type: 'query',
        source: new ElevationLayer({
          url: this.state.elevationLayer
        }),
        color: this.state.groundColor
      })
    }

    const viewProfile = this.checkForVolumetricObjects(jmv.view.type)
    if (viewProfile) {
      profiles.push(viewProfile)
    }

    //add input profile after the volumetric object
    if (jmv.view.type === '3d') {
      profiles.push({
        type: 'input', // view line Profile
        color: this.state.graphicsHighlightColor
      })
    }
    if(!this._drawTool){
      // Draw tool
      this._drawTool = new Draw({ view: jmv ? jmv.view : null, });
    }
    //Create new instance of ElevationProfileViewModel
    //update the exitings instance ONLY when volumetric objects are changed in all other cases create new instance
    //when volumetricObjectsChanged and _defaultViewModel is null still create new instance
    if (!this._defaultViewModel || !volumetricObjectsChanged) {
      this._defaultViewModel = new ElevationProfileViewModel({
        view: jmv ? jmv.view : null,
        profiles: profiles
      })
    } else if (volumetricObjectsChanged) {
      this._defaultViewModel.view = jmv.view
      //update the profiles
      this._defaultViewModel.profiles = profiles
      if (this._defaultViewModel.input?.geometry) {
        const abortController = new AbortController()
        this.setState({
          loadingIndicator: true
        })
        reactiveUtils.whenOnce(
          () => this._defaultViewModel.progress === 1, abortController.signal)
          .then(async () => {
            const isGroundProfileAvailable = this._defaultViewModel?.chartData?.lines?.find(l => (l.type === 'ground' || l.type === 'query'))
            if (this._defaultViewModel.chartData && isGroundProfileAvailable) {
              //as it takes some time to update the chart stats, after adding this timeout then only we received the updated stats
              await new Promise((resolve) => setTimeout(resolve, 500))
              this.onChartDataReady(abortController.signal)
            } else {
              this.onErrorInChartData(true, this.nls('noProfileError'))
            }
          })
      }
    }
    const intersectionResult: any = this.state.intersectionResult
    reactiveUtils?.watch(() => intersectionResult, async () => {
   console.log("changed")
    })
    const defaultViewModel: any = this._defaultViewModel
    //use reactiveUtils instead of watchUtils because it was deprecated at 4.24 and the plan is to remove it at 4.27 version
    //if view model having some error in its error state while drawing/selecting to generate the profile
    reactiveUtils?.watch(() => defaultViewModel.errorState, (errorState) => {
      const error = this.getErrorMsgState(errorState)
      if (error?.length === 0 || !error) {
        return
      }
      //on error abort the operation
      this._abortController?.abort()
      this.onErrorInChartData(error[0], error[1])
    }, { initial: true })

    reactiveUtils?.watch(() => defaultViewModel.input?.geometry, async () => {
      if (defaultViewModel.input) {
        try {
          // Abort any pending async operation if the input geometry changes again in the meantime.
          this._abortController?.abort()
          const { signal } = (this._abortController = new AbortController())
          // this.setState({
          //   loadingIndicator: true,
          //   onDrawingComplete: this._defaultViewModel.state === 'created'
          // })
          // Wait for the profile to be finished before proceeding.
          await reactiveUtils.whenOnce(() => defaultViewModel.progress === 1, signal)
          if (signal.aborted) {
            return
          }
          //if valid chartData then only perform further operations, else show error msg and hide loading indicator
          // added to resolve issue with volumetric objects, sometimes not shown correctly for first time
          await new Promise((resolve) => setTimeout(resolve, 1500))
          if (this._defaultViewModel.chartData) {
            //check if valid data for ground is available, if not show error and return
            const isGroundProfileAvailable = this._defaultViewModel?.chartData?.lines?.find(l => (l.type === 'ground' || l.type === 'query'))
            if (!isGroundProfileAvailable) {
              this.onErrorInChartData(true, this.nls('noProfileError'))
              return
            }
            //as it takes some time to update the chart stats, after adding this timeout then only we received the updated stats
            await new Promise((resolve) => setTimeout(resolve, 500))
            await this.onChartDataReady(signal)
          } else {
            this.onErrorInChartData(true, this.state.profileErrorMsg)
          }
        } catch (e) {
          // Ignore abort errors
          if (!promiseUtils.isAbortError(e)) {
            throw e
          }
        }
      }
    })
  }

  //create the view profile only in case of web scenes and when show in graph property in enabled in config
  checkForVolumetricObjects = (jimuMapViewType: string) => {
    if (jimuMapViewType === '3d' && this.props.config.configInfo[this.state.currentDatasource]?.profileChartSettings?.showVolumetricObjLineInGraph) {
      return {
        type: 'view', // view line Profile
        color: this.props.config.configInfo[this.state.currentDatasource]?.profileChartSettings?.volumetricObjLineColor
      }
    } else {
      return null
    }
  }
  
  onChartDataReady = async (signal) => {
    if (this.state.drawModeActive || this.state.selectModeActive) {
      const intersectionResult = await this.createBufferGraphics(true)
      if (signal.aborted) {
        return
      }
      this.setState({
        intersectionResult: intersectionResult,
        viewModelErrorState: false,
        profileResult: this._defaultViewModel.chartData,
        chartDataUpdateTime: Date.now()
      }, async () => {
        //as it takes some time to render the chart after setting data
        await new Promise((resolve) => setTimeout(resolve, 500))
        this.setState({
          loadingIndicator: false,
          startChartRendering: true
        })
      })
    }
  }

  /**
   * Set different required states in the widget, when error in getting valid chart data
   * @param viewModelErrorState boolean value of viewModelErrorState
   * @param errorMsg string error message
   */
  onErrorInChartData = (viewModelErrorState: boolean, errorMsg: string) => {
    this.setState({
      loadingIndicator: false,
      viewModelErrorState: viewModelErrorState,
      profileErrorMsg: errorMsg || this.nls('unknownError'),
      startChartRendering: false,
      profileResult: null,
      chartDataUpdateTime: Date.now()
    })
  }

  //create the buffer when line is drawn/selected
  createBufferGraphics = async (skipSettingResultState?: boolean): Promise<any[]> => {
    return new Promise((resolve) => {
      //Empty prev buffer graphic instance
      this.bufferGraphics = null
      if (!this.selectedBufferValues) {
        resolve([])
        return
      }
      if (this._defaultViewModel?.input) {
        //if buffer is enabled then create buffer and then get intersecting features
        //else directly get the intersecting features to the drawn/selected geometry
        if (this.selectedBufferValues.enabled && this.selectedBufferValues.bufferDistance > 0) {
          let inputGeometry = this._defaultViewModel.input.geometry.clone ? this._defaultViewModel.input.geometry.clone() : this._defaultViewModel.input.geometry
          //In some cases with add to selection the complete geometry will not be simplified
          //to the get the correct buffer the geometry should be simplified
          if (geometryEngine && !geometryEngine.isSimple(inputGeometry)) {
            inputGeometry = geometryEngine.simplify(inputGeometry)
          }
          geometryUtils.createBuffer(inputGeometry, [this.selectedBufferValues.bufferDistance], this.selectedBufferValues.bufferUnits).then((bufferGeometry) => {
            //as we will always deal with only one geometry get first geometry only
            const firstBufferGeom = Array.isArray(bufferGeometry) ? bufferGeometry[0] : bufferGeometry
            const bufferGraphics = new Graphic({
              geometry: firstBufferGeom,
              symbol: jsonUtils?.fromJSON(this.selectedBufferValues.bufferSymbol)
            })
            this.bufferGraphics = bufferGraphics
            if (bufferGraphics && this.bufferGraphics) {
              this.bufferLayer?.removeAll()
              this.bufferLayer?.add(bufferGraphics)
            }
            //check for intersecting assets once buffer is drawn
            //when creating buffer after selection or drawing, we are setting the intersectionResult in state along with chart data,
            //and when updating buffer while changing value, unit, intersection layers the state needs to be updated after the intersection
            this.checkForIntersectingLayer(skipSettingResultState).then((intersectionResult) => {
              resolve(intersectionResult)
            })
          })
        } else {
          this.bufferLayer?.removeAll()
          this.checkForIntersectingLayer(skipSettingResultState).then((intersectionResult) => {
            resolve(intersectionResult)
          })
        }
      } else {
        this.bufferLayer?.removeAll()
        if (!skipSettingResultState) {
          this.setState({
            intersectionResult: []
          })
        }
        resolve([])
      }
    })
  }

  //On buffer values changes at runtime
  onBufferChange = (bufferValues: AssetBufferIntersection) => {
    this.selectedBufferValues = bufferValues
    this.createBufferGraphics()
  }

  /**
  * The current error state of the widget, which allows it to display different
  * error messages while drawing/selecting on webmap/webscene
  *
  * @ignore
  */
  getErrorMsgState = (errorMsg): any => {
    switch (errorMsg) {
      case ElevationProfileErrorState.TooComplex:
        return [true, this.nls('tooComplexError')]
      case ElevationProfileErrorState.InvalidGeometry:
        return [true, this.nls('invalidGeometryError')]
      case ElevationProfileErrorState.InvalidElevationInfo:
        return [true, this.nls('invalidElevationInfoError')]
      case ElevationProfileErrorState.UnknownError:
        return [true, this.nls('unknownError')]
      case ElevationProfileErrorState.NoVisibleProfiles:
        return [true, this.nls('noProfileError')]
      case ElevationProfileErrorState.RefinedButNoChartData:
        return [true, this.nls('noProfileError')]
      case ElevationProfileErrorState.None:
        return []
    }
  }

  getSelectableLayers = (activeDs: string) => {
    const dataSource: DataSource[] = getAllLayersFromDataSource(activeDs)
    const selectedLayers = []
    const isSelectableLayerCustomized: boolean = this.canShowSelectAndDrawOptions(this.props.config.configInfo[activeDs]) &&
      this.canShowProfilingForBackward(this.props.config.configInfo[activeDs])

    dataSource?.forEach((layer: FeatureLayerDataSource) => {
      const eachLayer: any = layer
      if (eachLayer && eachLayer.layerDefinition && eachLayer.layerDefinition.geometryType) {
        if ((this.props.config.configInfo[activeDs]?.hasOwnProperty('advanceOptions') ||
            this.props.config.configInfo[activeDs]?.profileSettings?.hasOwnProperty('isProfileSettingsEnabled'))) {
          if (this.props.config.configInfo[activeDs]?.hasOwnProperty('advanceOptions') ||
              (this.props.config.configInfo[activeDs]?.profileSettings?.isProfileSettingsEnabled)) {
            //if selectable layers customize option is enabled in config then display all the configured layers in layers dropdown
            if ((this.props.config.configInfo[activeDs]?.advanceOptions ||
                (this.props.config.configInfo[activeDs]?.profileSettings?.isProfileSettingsEnabled)) && isSelectableLayerCustomized) {
              if (eachLayer.layerDefinition.geometryType === 'esriGeometryPolyline') {
                this.props.config.configInfo[activeDs]?.profileSettings.layers?.forEach((currentSetting) => {
                  if (currentSetting.layerId === layer.id) {
                    selectedLayers.push(layer.id)
                  }
                })
              }
            } else { //all line layers will be selectable
              if (eachLayer.layerDefinition.geometryType === 'esriGeometryPolyline') {
                selectedLayers.push(layer.id)
              }
            }
          }
        }
      }
    })
    this.selectableLayersAtRuntime = selectedLayers
  }

  /**
   * Check if selected record is of type polyline
   * Check if selected record have layer id
   * Check if selected record's layer is currently selectable
  */
  getValidFeatureRecord = (featureRecords) => {
    let validRecord = null
    // eslint-disable-next-line array-callback-return
    featureRecords.some((selectedRecord) => {
      let selectedLayersId = null
      if (selectedRecord?.feature?.layer?.id) {
        selectedLayersId = selectedRecord.feature.layer.id
      } else if (selectedRecord?.dataSource?.layer?.id) {
        selectedLayersId = selectedRecord.dataSource.layer.id
      }
      if (selectedLayersId && selectedRecord.feature?.geometry?.type === 'polyline') {
        const dsLayerId = this.getDSLayerID(selectedLayersId)
        if (!this.isSelectableLayersChangedAtRuntime) {
          this.getSelectableLayers(this.state.currentDatasource)
        }
        if (this.selectableLayersAtRuntime.includes(dsLayerId)) {
          validRecord = {}
          validRecord.record = selectedRecord
          validRecord.dsLayerId = dsLayerId
          return true
        }
      }
    })
    return validRecord
  }

  getDSLayerID = (layerId: string): string => {
    let dsLayerId = ''
    if (this.state?.jimuMapView?.dataSourceId) {
      const dataSource: DataSource[] = getAllLayersFromDataSource(this.state.jimuMapView.dataSourceId)
      dataSource?.forEach((ds) => {
        if (ds.jimuChildId === layerId) {
          dsLayerId = ds.id
          return true
        }
      })
    }
    return dsLayerId
  }

  /**
   * Get out fields for datasource instance
   * @param dsLayer data source layer instance
   * @returns out fields
   */
  getOutfieldsForDs = (dsLayer: FeatureLayerDataSource): string[] => {
    let outFields = []
    this.props.useDataSources.forEach((ds) => {
      if (ds.dataSourceId === dsLayer.id && ds.fields) {
        outFields = [...ds.fields]
      }
    })
    if (!outFields.includes(dsLayer.layer.objectIdField)) {
      outFields.push(dsLayer.layer.objectIdField)
    }
    return outFields
  }

  getFeatureFromLayer = async (dsLayerId: string, oid) => {
    const dataSource = DataSourceManager.getInstance().getDataSource(dsLayerId) as FeatureLayerDataSource
    const query: FeatureLayerQueryParams = {}
    query.where = dataSource.layer.objectIdField + ' = ' + oid
    query.outFields = this.getOutfieldsForDs(dataSource)
    query.returnGeometry = true
    query.returnFullGeometry = true
    query.returnZ = true
    query.notAddFieldsToClient = true
    query.outSR = this.mapView.view.spatialReference.toJSON()
    return new Promise((resolve) => {
      return dataSource.query(query).then((results) => {
        if (results?.records.length > 0) {
          let feature
          results.records.forEach((record: FeatureDataRecord) => {
            feature = record.feature
            return feature ?? null
          })
          resolve(feature)
        }
      })
    })
  }

  displayFeaturesResult = (layerDsId, selectedFeature) => {
    const featuresByLayer = {}
    featuresByLayer[layerDsId] = selectedFeature
    this.setState({
      initialStage: false,
      resultStage: true,
      selectModeActive: true,
      drawModeActive: false,
      onDrawingComplete: false,
      startChartRendering: false,
      viewModelErrorState: false
    })

    //Clear the draw tool
    if (this._defaultViewModel) {
      this._defaultViewModel.clear()
    }
    //Clear select tool symbol from map
    if (this.state.drawModeActive || this.state.selectModeActive) {
      this.state.currentSketchVM?.cancel()
    }
    //hide chart position
    this.hideChartPosition()
    //apply the same logic for displaying the profile as selected line feature from elevation profile widget
    this.queryForNewSelection(featuresByLayer, false)
  }

  componentDidUpdate = (prevProps) => {
    const currentWidgetState = getAppStore()?.getState()?.widgetsRuntimeInfo?.[this.props.id]?.state
    if (currentWidgetState === WidgetState.Opened || !currentWidgetState) {
      //check for feature selected using message action
      // if featureRecord found and prev selected record is not matching with the current then only load the profile for selected feature
      const featureRecords = this.props?.selectedFeatureRecords as any
      if (featureRecords?.length > 0 &&
        (!prevProps || !prevProps.mutableStatePropsVersion || !prevProps.mutableStatePropsVersion.selectedFeatureRecords ||
          prevProps?.mutableStatePropsVersion?.selectedFeatureRecords !== this.props.mutableStatePropsVersion?.selectedFeatureRecords)) {
        const validRecord = this.getValidFeatureRecord(featureRecords)
        if (validRecord?.record) {
          this.getFeatureFromLayer(validRecord.dsLayerId, validRecord.record.getId()).then((feature) => {
            this.displayFeaturesResult(validRecord.dsLayerId, [feature])
          })
        } else {
          return
        }
      }
    }

    if (this.props.appMode !== prevProps.appMode && this.props.appMode === AppMode.Run) {
      if (this.state.addToSelectionTool) {
        this._displayAddToSelectionCursor()
      }
    } else if (this.props.appMode !== prevProps.appMode && this.props.appMode === AppMode.Design) {
      this._displayDefaultCursor()
    }
    if (!this.mapView) {
      return
    }
    //if map or active data source configuration is changed, update SketchVM and map instance
    if (prevProps.useMapWidgetIds !== this.props.useMapWidgetIds ||
      prevProps.config.activeDataSource !== this.props.config.activeDataSource) {
      if (this.props.config.configInfo[this.props.config.activeDataSource]) {
        this.setState({
          currentDatasource: this.props.config.activeDataSource
        }, () => {
          this.checkLineLayerAvailableInDsAndConfig(this.state.currentDatasource)
          this.getSelectedFeatureRecords(this.mapView?.dataSourceId)
          this.setState({
            customElevationLayer: this.props.config.configInfo[this.state.currentDatasource].profileChartSettings.isCustomElevationLayer,
            elevationLayer: this.props.config.configInfo[this.state.currentDatasource].profileChartSettings.elevationLayerURL
          })
        })
      }
    }

    if (prevProps.state !== this.props.state && (!this.state.profileResult && (this.state.drawModeActive || this.state.selectModeActive))) {
      //check widget the state open/close in live view
      const widgetState = getAppStore().getState().widgetsRuntimeInfo[this.props.id].state
      if (widgetState === WidgetState.Opened || !widgetState) {
        this.loadSelectDrawToolOnLoad(this.activeCurrentDs)
        this.getSelectedFeatureRecords(this.mapView?.dataSourceId)
      }
    }

    const currentConfig = this.props.config.configInfo?.[this.state.currentDatasource]
    const prevConfig = prevProps.config.configInfo?.[this.state.currentDatasource]

    if (this.props.config.configInfo.hasOwnProperty(this.state.currentDatasource)) {
      this.checkLineLayerAvailableInDsAndConfig(this.state.currentDatasource)
      this.setConfigForDataSources()
    }

    //profile chart settings
    if (prevConfig?.profileChartSettings.groundColor !== currentConfig?.profileChartSettings.groundColor ||
      prevConfig?.profileChartSettings.graphicsHighlightColor !== currentConfig?.profileChartSettings.graphicsHighlightColor
    ) {
      this.setState({
        groundColor: currentConfig?.profileChartSettings.groundColor,
        graphicsHighlightColor: currentConfig?.profileChartSettings.graphicsHighlightColor
      }, () => {
        this.setState({
          chartColorRender: this.state.groundColor
        })
        if (this.drawingLayer && this.drawingLayer.graphics.length > 0) {
          const polylineSymbol = {
            type: 'simple-line',
            color: this.state.graphicsHighlightColor,
            width: 5
          }
          const graphics: any = this.drawingLayer.graphics
          const individualGraphicItems = graphics.items
          individualGraphicItems.forEach((graphic) => {
            graphic.symbol = polylineSymbol
          })
        }
        if (this._defaultViewModel && this.state.groundColor) {
          this._defaultViewModel.profiles.getItemAt(0)?.color?.setColor(this.state.groundColor)
        }
      })
    }

    if (prevConfig?.profileChartSettings.elevationUnit !== currentConfig?.profileChartSettings.elevationUnit ||
      prevConfig?.profileChartSettings.linearUnit !== currentConfig?.profileChartSettings.linearUnit) {
      this.setState({
        selectedLinearUnit: currentConfig?.profileChartSettings.linearUnit,
        selectedElevationUnit: currentConfig?.profileChartSettings.elevationUnit
      })
    }

    //clear all the graphics and chart when elevation layer changed in live view
    if (prevConfig?.profileChartSettings.elevationLayerURL !== currentConfig?.profileChartSettings.elevationLayerURL ||
      prevConfig?.profileChartSettings.isCustomElevationLayer !== currentConfig?.profileChartSettings.isCustomElevationLayer) {
      if (currentConfig && prevConfig) {
        this.setState({
          elevationLayer: currentConfig?.profileChartSettings.elevationLayerURL
        }, () => {
          if (!this.state.initialStage) {
            this.activateToolForNewProfile()
          }
          this.createEpViewModel(this.mapView)
        })
      }
    }

    //check if profile layers config are updated in live view mode
    if (this.didProfileLayersSettingsChanged(prevConfig?.profileSettings.layers, currentConfig?.profileSettings.layers) ||
      this.checkForPrevCurrentAdvanceConfig(prevConfig, currentConfig, this.nls('selectableLayersLabel'))) {
      this.setState({
        profileLineLayers: currentConfig?.profileSettings.layers
      }, () => {
        this.getSelectableLayers(this.state.currentDatasource)
        let noLineConfigured: boolean = false
        if (currentConfig?.profileSettings.isProfileSettingsEnabled && this.state.profileLineLayers.length === 0 && !this.state.drawModeActive &&
           ((!currentConfig?.profileSettings.isCustomizeOptionEnabled && !this.state.selectModeActive) ||
          (currentConfig?.profileSettings.isCustomizeOptionEnabled && this.state.selectModeActive))) {
          this.onBackClick()
          noLineConfigured = true
        }

        if (!currentConfig?.profileSettings.isProfileSettingsEnabled && !this.state.drawModeActive) {
          this.onBackClick()
          noLineConfigured = true
        }

        if (!currentConfig?.assetSettings?.isAssetSettingsEnabled) {
          if (this.bufferLayer) {
            this.bufferLayer.removeAll()
          }
        } else {
          this.createBufferGraphics()
        }
        this.setState({
          lineLayersNotFound: noLineConfigured
        })
      })
    }

    //check if intersecting layers are modified in live view mode
    if (this.didIntersectingLayersSettingsChanged(prevConfig?.assetSettings?.layers, currentConfig?.assetSettings?.layers) ||
      this.checkForPrevCurrentAdvanceConfig(prevConfig, currentConfig, this.nls('intersectingLayersLabel'))) {
      if (currentConfig?.assetSettings?.isAssetSettingsEnabled) {
        this.createBufferGraphics()
      } else if (this.bufferLayer) {
        this.bufferLayer.removeAll()
      }
    }

    //check if volumetric objects config are updated in live view mode
    if (prevConfig?.profileChartSettings.volumetricObjLineColor !== currentConfig?.profileChartSettings.volumetricObjLineColor ||
      prevConfig?.profileChartSettings.showVolumetricObjLineInGraph !== currentConfig?.profileChartSettings.showVolumetricObjLineInGraph) {
      if (this._defaultViewModel && this.state.jimuMapView.view?.type === '3d') {
        this.createEpViewModel(this.mapView, true)
      }
    }

    this.setnearbyPolespolyline()
  }

  //for backward comaptibility check for the prev and current config for advance and profile or asset settings
  checkForPrevCurrentAdvanceConfig = (prevConfig, currentConfig, configLayerType: string) => {
    let isLayersSettingsEnabled: boolean = false
    if (configLayerType === this.nls('selectableLayersLabel')) {
      if (prevConfig && (((prevConfig?.hasOwnProperty('advanceOptions') && prevConfig?.advanceOptions) !==
      (currentConfig?.hasOwnProperty('advanceOptions') && currentConfig?.advanceOptions)) ||
        ((prevConfig?.profileSettings.hasOwnProperty('isProfileSettingsEnabled') && prevConfig?.profileSettings?.isProfileSettingsEnabled) !==
          (currentConfig?.profileSettings.hasOwnProperty('isProfileSettingsEnabled') && currentConfig?.profileSettings?.isProfileSettingsEnabled)) ||
          ((prevConfig?.profileSettings.hasOwnProperty('isCustomizeOptionEnabled') && prevConfig?.profileSettings?.isCustomizeOptionEnabled) !==
          (currentConfig?.profileSettings.hasOwnProperty('isCustomizeOptionEnabled') && currentConfig?.profileSettings?.isCustomizeOptionEnabled)))) {
        isLayersSettingsEnabled = true
      }
    }
    if (configLayerType === this.nls('intersectingLayersLabel')) {
      if (prevConfig && (((prevConfig?.hasOwnProperty('advanceOptions') && prevConfig?.advanceOptions) !==
      (currentConfig?.hasOwnProperty('advanceOptions') && currentConfig?.advanceOptions)) ||
        (prevConfig?.hasOwnProperty('assetSettings') && (prevConfig?.assetSettings?.hasOwnProperty('isAssetSettingsEnabled') && prevConfig?.assetSettings?.isAssetSettingsEnabled) !==
          (currentConfig?.assetSettings?.hasOwnProperty('isAssetSettingsEnabled') && currentConfig?.assetSettings?.isAssetSettingsEnabled)))) {
        isLayersSettingsEnabled = true
      }
    }
    return isLayersSettingsEnabled
  }

  didProfileLayersSettingsChanged = (prevProfileLayers, currentProfileLayers) => {
    let profileSettingsChanged = false
    if (prevProfileLayers?.length !== currentProfileLayers?.length) {
      profileSettingsChanged = true
    }
    return profileSettingsChanged
  }

  didIntersectingLayersSettingsChanged = (prevIntersectingLayers, currentIntersectingLayers) => {
    let intersectingSettingsChanged = false
    if (prevIntersectingLayers?.length !== currentIntersectingLayers?.length) {
      intersectingSettingsChanged = true
    }
    return intersectingSettingsChanged
  }

  componentWillUnmount = () => {
    if (this._defaultViewModel) {
      this._defaultViewModel.clear()
    }
    if (this.state.currentSketchVM) {
      this.state.currentSketchVM?.cancel()
    }
    //remove previously drawn graphics
    this.destroyDrawingLayers()
    //this will reset the cursor to default
    this._displayDefaultCursor()
    //clear the selected features from map if any present
    this.mapView?.clearSelectedFeatures()
  }

  buildOutputStatistics = (selectedElevationUnit, selectedLinearUnit, isFlip) => {
    this.buildStatsValuesAsOutput(this._defaultViewModel?.visibleProfiles?.[0], this.props.outputDataSources?.[0], selectedElevationUnit, selectedLinearUnit, isFlip)
  }

  //get output data source from data source manager instance
  getOutputDataSource = (outputDs) => {
    return DataSourceManager.getInstance().getDataSource(outputDs)
  }

  //create output statistics for other widgets
  buildStatsValuesAsOutput = (profileResult, outputDs, selectedElevationUnit, selectedLinearUnit, isFlip) => {
    if (!this.getOutputDataSource(outputDs)) {
      return
    }
    const statsFields = []

    statsFields.push({
      alias: 'OBJECTID',
      type: 'double',
      name: 'OBJECTID'
    })

    epStatistics.forEach((stats) => {
      statsFields.push({
        alias: this.nls(stats.value).replace(/ /g, ''),
        type: 'string',
        name: stats.value
      })
    })

    // statistics values which will be displayed or use in other widgets
    const statsValues: any = {}

    const statsResult = this.outputStatisticsValueDisplay(profileResult, selectedElevationUnit, selectedLinearUnit, isFlip)
    statsValues.OBJECTID = 0
    statsResult.forEach((stats, index) => {
      statsValues[statsFields[index + 1]?.name] = stats?.statValue
    })

    const fieldsInPopupTemplate = []
    statsFields.forEach((stats) => {
      if (stats.name) {
        const fieldsItem = {
          fieldName: stats.name,
          label: stats.alias
        }
        fieldsInPopupTemplate.push(fieldsItem)
      }
    })

    //to fix the backward compatility issue
    //push the stats fields schema again with the field name same as alias
    const statsFieldsLength = statsFields.length
    epStatistics.forEach((stats) => {
      statsFields.push({
        alias: this.nls(stats.value).replace(/ /g, ''),
        type: 'string',
        name: this.nls(stats.value).replace(/ /g, '')
      })
    })

    //also assign the stats values again to the fields name
    statsResult.forEach((stats, index) => {
      statsValues[statsFields[index + statsFieldsLength]?.name] = stats?.statValue
    })

    //define dummy geometry as for profile stats value we don't have any geometry
    const dummyGeometry = {
      type: 'polyline',
      paths: [],
      spatialReference: { wkid: 4326 }
    }
    const statGraphic = new Graphic({
      attributes: statsValues,
      geometry: this._defaultViewModel?.input?.geometry ?? dummyGeometry
    })

    const messages = Object.assign({}, jimuUIDefaultMessages)
    //create custom feature layer with all the statistics info
    const layer = new FeatureLayer({
      id: outputDs + '_layer',
      title: this.props.intl.formatMessage({ id: 'outputStatistics', defaultMessage: messages.outputStatistics }, { name: this.props.label }),
      fields: statsFields,
      geometryType: 'polyline',
      source: [statGraphic],
      objectIdField: 'OBJECTID',
      popupTemplate: { //feature info widget popup title
        title: this.props.intl.formatMessage({ id: 'outputStatistics', defaultMessage: messages.outputStatistics }, { name: this.props.label }),
        fieldInfos: fieldsInPopupTemplate,
        content: [{
          type: 'fields',
          fieldInfos: fieldsInPopupTemplate
        }]
      }
    })
    const featureLayerDs = this.getOutputDataSource(outputDs) as FeatureLayerDataSource
    featureLayerDs.layer = layer
    const dsStatus = statsValues ? DataSourceStatus.Unloaded : DataSourceStatus.NotReady
    //update the data source status
    this.getOutputDataSource(outputDs)?.setStatus(dsStatus)
    this.getOutputDataSource(outputDs)?.setCountStatus(dsStatus)
    this.getOutputDataSource(outputDs)?.addSourceVersion()
  }

  outputStatisticsValueDisplay = (profileResult, selectedElevationUnit, selectedLinearUnit, isFlip) => {
    const items = []
    let statsValueWithUnit = ''
    let statsValue = null
    let statisticsName = ''
    epStatistics.forEach((stat) => {
      statisticsName = stat.value
      if (!profileResult?.statistics) {
        statsValueWithUnit = this.nls('noStatsValue')
      } else {
        if (isFlip) {
          if (statisticsName !== ElevationProfileStatisticsName.AvgElevation &&
            statisticsName !== ElevationProfileStatisticsName.MaxDistance &&
            statisticsName !== ElevationProfileStatisticsName.MaxElevation &&
            statisticsName !== ElevationProfileStatisticsName.MinElevation) {
            statisticsName = getReverseStatsOnFlip(statisticsName)
          }
        }
        statsValue = profileResult?.statistics?.[statisticsName]
        statsValueWithUnit = this.getStatsValueWithUnit(profileResult, statsValue, statisticsName, selectedElevationUnit, selectedLinearUnit)
      }
      items.push({
        statName: stat.value,
        statValue: statsValueWithUnit
      })
    })
    return items
  }

  getStatsValueWithUnit = (profileResult, statVal, name, selectedElevationUnit, selectedLinearUnit) => {
    let roundOffStat = ''
    let convertedStats: number = null
    unitOptions.forEach((unit) => {
      if (name === ElevationProfileStatisticsName.MaxDistance) {
        if (unit.value === selectedLinearUnit) {
          convertedStats = convertSingle(statVal, profileResult?.effectiveUnits.distance, selectedLinearUnit)
          roundOffStat = this.props.intl.formatNumber(convertedStats, { maximumFractionDigits: 2 }) + ' ' + this.nls(unit.abbreviation)
        }
      } else if (name === ElevationProfileStatisticsName.MaxPositiveSlope || name === ElevationProfileStatisticsName.MaxNegativeSlope ||
        name === ElevationProfileStatisticsName.AvgPositiveSlope || name === ElevationProfileStatisticsName.AvgNegativeSlope) { //Slope values in degree unit
        if (statVal === null) {
          roundOffStat = this.nls('noStatsValue')
        } else {
          roundOffStat = this.props.intl.formatNumber(statVal, { maximumFractionDigits: 2 }) + ' ' + '\u00b0'
        }
      } else {
        if (unit.value === selectedElevationUnit) {
          convertedStats = convertSingle(statVal, profileResult?.effectiveUnits.elevation, selectedElevationUnit)
          roundOffStat = this.props.intl.formatNumber(convertedStats, { maximumFractionDigits: 2 }) + ' ' + this.nls(unit.abbreviation)
        }
      }
    })
    return roundOffStat
  }

  queryForNewSelection = (featuresByLayer, selectedUsingEPSelectTool: boolean) => {
    let newSelectedFeature: Graphic = null
    if (Object.keys(featuresByLayer).length > 0) {
      for (const dsLayerId in featuresByLayer) {
        const features = featuresByLayer[dsLayerId]
        if (features.length > 0) {
          //In current release we will be dealing with only first feature out of multiple features from multiple layers
          //TODO: In future we may have to provide the features list and allow user to select one feature
          if (features[0].geometry?.type === 'polyline' && this.selectableLayersAtRuntime.includes(dsLayerId)) {
            //In 3d, update the elevation info of drawing and nextPossibleSelectionLayer according to the first selected feature
            if (this.state.jimuMapView.view.type === '3d' && features[0]?.layer?.elevationInfo) {
              const elevationInfo = features[0]?.layer?.elevationInfo
              this.drawingLayer.set('elevationInfo', elevationInfo)
              this.nextPossibleSelectionLayer.set('elevationInfo', elevationInfo)
            }
            this.newFeatureSelection = true
            this.setState({
              noGraphicAfterFirstSelection: true
            })
            newSelectedFeature = new Graphic(
              {
                geometry: features[0]?.geometry,
                attributes: features[0]?.attributes ? features[0]?.attributes : {}
              }
            )
            newSelectedFeature.attributes.esriCTFeatureLayerId = dsLayerId
            //to remove the extra selection form map view, done by system while showing info-window of selected features
            //this should be done only when selecting features using EP select tool
            if (selectedUsingEPSelectTool) {
              this.mapView.clearSelectedFeatures()
            }
            break
          }
        }
      }
    }
    //clear the graphics added by drawing tool
    if (this.drawingLayer || this.bufferLayer) {
      this.drawingLayer.removeAll()
      this.bufferLayer.removeAll()
    }
     //clear the graphics added by drawingpoleline tool
    //  if (this.poleDrawingLayer) {
    //   this.poleDrawingLayer.removeAll()
    // }
    if (newSelectedFeature) {
      this.setState({
        drawModeActive: false,
        noFeaturesError: false,
        viewModelErrorState: false
      })
      //get the geometry in map SR
      geometryUtils.projectToSpatialReference([newSelectedFeature.geometry],
        this.state.jimuMapView.view.spatialReference).then((projectedGeometries) => {
        //On success return the projected geometry
        //as are passing only one geometry we are looking for only the first result
        if (projectedGeometries?.length > 0) {
          newSelectedFeature.geometry = projectedGeometries[0]
        }
        this.selectFeatureForProfiling(newSelectedFeature)
      }, (err) => {
        console.log(err)
        //In case of error return the original geometry and log error
        this.selectFeatureForProfiling(newSelectedFeature)
      })
    } else {
      //reactivate sketch view model to select another point
      if (this.state.selectModeActive) {
        this.state.currentSketchVM.create('point')
      }
      //show error in widget panel
      this.setState({
        loadingIndicator: false,
        noFeaturesError: true
      }, () => {
        setTimeout(() => {
          //clear the selected features from map if no profile is generated
          this.mapView?.clearSelectedFeatures()
        }, 100)
      })
    }
  }

  checkForIntersectingLayer = (skipSettingResultState: boolean | undefined): Promise<any[]> => {
    return new Promise((resolve) => {
      const defArr: Array<Promise<LayerIntersectionInfo | null>> = []
      if (this.intersectingLayersAtRuntime?.length > 0) {
        const selectableLineGeom = this._defaultViewModel?.input?.geometry
        const dsManager = DataSourceManager.getInstance()
        const assetLayersCurrentConfig = this.props.config.configInfo[this.state.currentDatasource]?.assetSettings?.layers
        assetLayersCurrentConfig.forEach((currentSetting) => {
          if (this.intersectingLayersAtRuntime.includes(currentSetting.layerId)) {
            const layerDs = dsManager.getDataSource(currentSetting.layerId) as FeatureLayerDataSource
            if (layerDs && layerDs.layer && this.considerLayerVisibility(layerDs.id)) {
              defArr.push(this.queryForIntersectingLayers(currentSetting, selectableLineGeom))
            }
          }
        })
      }
      Promise.all(defArr).then((intersectionResult: Array<LayerIntersectionInfo | null>) => {
        if (!skipSettingResultState) {
          this.setState({
            intersectionResult: intersectionResult
          })
        }
        resolve(intersectionResult)
      })
    })
  }

  queryForIntersectingLayers = async (assetLayerSettings, selectableLineGeom?): Promise<LayerIntersectionInfo | null> => {
    const bufferGraphics = this.bufferGraphics
    const ds: any = DataSourceManager.getInstance().getDataSource(assetLayerSettings?.layerId) as QueriableDataSource
    return new Promise((resolve) => {
      if (ds?.layerDefinition?.geometryType === 'esriGeometryPolyline' || ds?.layerDefinition?.geometryType === 'esriGeometryPoint') {
        //create the query params
        const intersectingFeatureQuery: FeatureLayerQueryParams = {}
        intersectingFeatureQuery.geometry = bufferGraphics?.geometry ? bufferGraphics.geometry.toJSON() : selectableLineGeom.toJSON()
        intersectingFeatureQuery.returnGeometry = true
        intersectingFeatureQuery.returnZ = true

        //get ids of the features which are used for selection, and skip those features from intersection
        const selectedFeaturesQueryString = this.filterExistingFeatures(ds)
        if (selectedFeaturesQueryString) {
          intersectingFeatureQuery.where = selectedFeaturesQueryString
        }
        //always get the objectId
        intersectingFeatureQuery.outFields = [ds.layerDefinition.objectIdField]
        //get the configured display field
        if (assetLayerSettings.displayField && !intersectingFeatureQuery.outFields.includes(assetLayerSettings.displayField)) {
          intersectingFeatureQuery.outFields.push(assetLayerSettings.displayField)
        }
        //get the configured field1 for elevation
        if (assetLayerSettings.elevationSettings?.field1 && !intersectingFeatureQuery.outFields.includes(assetLayerSettings.elevationSettings.field1)) {
          intersectingFeatureQuery.outFields.push(assetLayerSettings.elevationSettings.field1)
        }
        //get the configured field2 for elevation
        if (assetLayerSettings.elevationSettings?.field2 && !intersectingFeatureQuery.outFields.includes(assetLayerSettings.elevationSettings.field2)) {
          intersectingFeatureQuery.outFields.push(assetLayerSettings.elevationSettings.field2)
        }
        intersectingFeatureQuery.outFields = this.getOutfieldsForDs(ds)
        intersectingFeatureQuery.notAddFieldsToClient = true
        intersectingFeatureQuery.outSR = this.mapView.view.spatialReference.toJSON()
        // Adding extra 0.1 meters buffer to get the features which are on the edge
        //this is to fix the issue we had observed and was getting fixed after adding 0.1m buffer
        intersectingFeatureQuery.distance = 0.1
        intersectingFeatureQuery.units = 'esriSRUnit_Meter'
        try {
          ds.query(intersectingFeatureQuery).then((results) => {
            const intersectionResultForLayer: IntersectionResult[] = []
            //selected polyline or buffer
            if (results?.records.length > 0) {
              results.records.forEach((record) => {
                const feature = record.feature
                const disconnectedFeatureForProfiling = []
                const connectedFeatureForProfiling = []

                const iResult: IntersectionResult = {
                  connectedFeatureForProfiling: connectedFeatureForProfiling,
                  disconnectedFeatureForProfiling: disconnectedFeatureForProfiling,
                  intersectingFeature: feature,
                  record: record
                }
                const intersectingFeatureGeom = feature.geometry
                //in case of polyline find the intersecting segments and disconnected points
                if (intersectingFeatureGeom.type === 'polyline') {
                  let selectedOrBufferLineGeom = selectableLineGeom
                  //get all intersecting polyline (Parallel lines with same x and y)
                  //if buffer preset use buffer to get intersecting line else use the selected line geometry
                  const intersectingLineToTheLine: Geometry | Geometry[] =
                    geometryEngine.intersect(intersectingFeatureGeom, bufferGraphics ? bufferGraphics.geometry : selectedOrBufferLineGeom)
                  //consider all the intersecting lines to be shown in graph, these could be multiple paths
                  if (intersectingLineToTheLine) {
                    connectedFeatureForProfiling.push(intersectingLineToTheLine)
                  }
                  //if buffer present, construct buffer outline by passing the buffer rings to a polyline geometry.
                  //this is for finding the intersecting points on buffer edges or the selected line
                  if (bufferGraphics) {
                    const bufferGeom: any = bufferGraphics.geometry
                    selectedOrBufferLineGeom = new Polyline({
                      hasZ: bufferGeom.hasZ,
                      hasM: bufferGeom.hasM,
                      paths: bufferGeom.rings,
                      spatialReference: bufferGeom.spatialReference
                    })
                  }
                  //now to find the disconnected points to be plotted on graph
                  const intersectingPointToTheLine = geometryEngine.intersectLinesToPoints(intersectingFeatureGeom, selectedOrBufferLineGeom)
                  //when any points are intersecting the selectedOrBufferLineGeom
                  //if those points are intersecting with result in intersectingLineToTheLine Geometry means those points are already considered
                  //and hence skip them and for those which are not intersecting add them to disconnected points
                  if (intersectingPointToTheLine.length > 0) {
                    intersectingPointToTheLine.forEach((intersectingPointFeature) => {
                      if (!intersectingLineToTheLine) {
                        disconnectedFeatureForProfiling.push(intersectingPointFeature)
                      } else {
                        const checkFeatureForProfiling = geometryEngine.intersects(intersectingPointFeature, intersectingLineToTheLine as Geometry)
                        if (!checkFeatureForProfiling) {
                          disconnectedFeatureForProfiling.push(intersectingPointFeature)
                        }
                      }
                    })
                  }
                }
                intersectionResultForLayer.push(iResult)
              })
            }
            const layerIntersectionInfo: LayerIntersectionInfo = {
              title: ds.getLabel(),
              settings: assetLayerSettings,
              intersectionResult: intersectionResultForLayer,
              inputGeometry: selectableLineGeom
            }
            resolve(layerIntersectionInfo)
          }, (err) => {
            console.log(err)
            resolve(null)
          })
        } catch (e) {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    })
  }

  /**
   *
   * If layer is invisible by scale-dependent visibility, layer definitions and filters then user will unable to select the feature
  */

  considerLayerVisibility = (dsId): boolean => {
    const mapLayer = this.mapView.getJimuLayerViewByDataSourceId(dsId).layer
    const layersVisibility = mapLayer.visible &&
      ((mapLayer.minScale >= this.mapView.view.scale && mapLayer.maxScale <= this.mapView.view.scale) ||
        (mapLayer.minScale === 0 && mapLayer.maxScale <= this.mapView.view.scale) ||
        (mapLayer.maxScale === 0 && mapLayer.minScale >= this.mapView.view.scale) ||
        (mapLayer.minScale === 0 && mapLayer.maxScale === 0))
    return layersVisibility
  }

  queryForIndividualLayers = (geometry) => {
    const defArr = []
    const dsManager = DataSourceManager.getInstance()
    //use all the layers for selecting if ground elevation option is on under selectable layers options
    if (!(this.canShowSelectAndDrawOptions(this.props.config.configInfo[this.state.currentDatasource]) &&
      this.canShowProfilingForBackward(this.props.config.configInfo[this.state.currentDatasource]))) {
      this.selectableLayersAtRuntime.forEach((selectableLayerId) => {
        const layerDs = dsManager.getDataSource(selectableLayerId) as FeatureLayerDataSource
        if (layerDs && layerDs.layer && this.considerLayerVisibility(layerDs.id)) {
          const layerDefinition = layerDs.getLayerDefinition()
          if (layerDefinition?.geometryType && layerDefinition.geometryType === 'esriGeometryPolyline') {
            defArr.push(this.queryIndividualLayer(layerDs.layer, layerDs, geometry))
          }
        }
      })
    } else { //use configured line layers of selection
      if (this.props.config.configInfo[this.state.currentDatasource]?.profileSettings.layers.length > 0) {
        const layersCurrentConfig = this.props.config.configInfo[this.state.currentDatasource]?.profileSettings.layers
        //selectable layers at runtime
        layersCurrentConfig.forEach((currentSetting) => {
          if (this.selectableLayersAtRuntime.includes(currentSetting.layerId)) {
            const layerDs = dsManager.getDataSource(currentSetting.layerId) as FeatureLayerDataSource
            if (layerDs && layerDs.layer && this.considerLayerVisibility(layerDs.id)) {
              defArr.push(this.queryIndividualLayer(layerDs.layer, layerDs, geometry))
            }
          }
        })
      }
    }
    return defArr
  }

  queryIndividualLayer = async (layer, layerDs: any, selectedGeometry): Promise<any[]> => {
    const metersPerVSRForLayer = this.getMetersForVerticalSR(layer)
    const queryString = this.filterExistingFeatures(layerDs)
    const layerDefinition = layer.definitionExpression
    const currentDateTime = Date.now() // To dirty the query string so that data will be fetched from server
    const lineLayerQuery: FeatureLayerQueryParams = {}
    lineLayerQuery.geometry = selectedGeometry.toJSON()
    lineLayerQuery.returnFullGeometry = true
    lineLayerQuery.returnGeometry = true
    lineLayerQuery.returnZ = true
    lineLayerQuery.outFields = this.getOutfieldsForDs(layerDs)
    lineLayerQuery.notAddFieldsToClient = true
    lineLayerQuery.outSR = this.mapView.view.spatialReference.toJSON()
    if (queryString) {
      if (layerDefinition) {
        lineLayerQuery.where = queryString + ' AND ' + layerDefinition + ' AND ' + currentDateTime + '=' + currentDateTime
      } else {
        lineLayerQuery.where = queryString + ' AND ' + currentDateTime + '=' + currentDateTime
      }
    } else if (layerDefinition) {
      lineLayerQuery.where = layerDefinition + ' AND ' + currentDateTime + '=' + currentDateTime
    } else {
      lineLayerQuery.where = currentDateTime + '=' + currentDateTime
    }
    let result = []
    try {
      await layerDs.query(lineLayerQuery).then((results) => {
        const resultFeatures = []
        if (results?.records.length > 0) {
          //get features from each records
          results.records.forEach((record) => {
            const feature = record.feature
            resultFeatures.push(feature)
            // Z value after queryFeatures are returned in SR of the map, only if layer don't have vertical SR
            // so in case when we have vertical SR for layer, convert the z values in map sr unit
            // multiply the value with metersPerSRForLayer will convert z value in meters
            // after that divide the value by metersPerSRForMap will give the value in mapSR unit
            if (metersPerVSRForLayer) {
              const metersPerSRForMap = unitUtils.getMetersPerUnitForSR(new SpatialReference(this.mapView.view.spatialReference.toJSON()))
              const eachGeometry = feature.geometry
              if (eachGeometry.paths.length > 0) {
                eachGeometry.paths.forEach((eachPath) => {
                  if (eachPath.length > 0) {
                    eachPath.forEach((eachPoint) => {
                      if (eachPoint.length > 1) {
                        eachPoint[2] = (eachPoint[2] * metersPerVSRForLayer) / metersPerSRForMap
                      }
                    })
                  }
                })
              }
            }
            feature.attributes.esriCTFeatureLayerId = layerDs.dataSourceJson.id
          })
        }
        result = resultFeatures
      }, (err) => {
        console.log(err)
      })
    } catch (e) {
      result = []
    }
    return result
  }

  getMetersForVerticalSR = (layer) => {
    let metersPerSR = 1
    //get Units from VCS of layers source SR
    if (layer.sourceJSON?.sourceSpatialReference?.vcsWkid) {
      metersPerSR = unitUtils.getMetersPerVerticalUnitForSR(new SpatialReference({ wkid: layer.sourceJSON.sourceSpatialReference.vcsWkid }))
    } else if (layer.sourceJSON?.sourceSpatialReference?.vcsWkt) {
      metersPerSR = unitUtils.getMetersPerVerticalUnitForSR(new SpatialReference({ wkid: layer.sourceJSON.sourceSpatialReference.vcsWkt }))
    } else {
      metersPerSR = null
    }
    return metersPerSR
  }

  filterExistingFeatures = (layer) => {
    let oIdQueryString = ''
    const oIdField = layer.layer.objectIdField
    //Get the collection of graphics from the respective layer
    const layerFeatureGraphics = this.drawingLayer.graphics.filter((graphic) => {
      if (graphic?.attributes?.hasOwnProperty('esriCTFeatureLayerId') &&
        graphic.attributes.esriCTFeatureLayerId === layer.dataSourceJson.id) {
        return true
      } else {
        return false
      }
    })
    layerFeatureGraphics.forEach((graphic, index) => {
      if (graphic?.attributes?.hasOwnProperty('esriCTFeatureLayerId') &&
        graphic.attributes.esriCTFeatureLayerId === layer.dataSourceJson.id) {
        if (index === layerFeatureGraphics.length - 1) {
          oIdQueryString += oIdField + ' <> ' +
            graphic.attributes[oIdField]
        } else {
          oIdQueryString += oIdField + ' <> ' +
            graphic.attributes[oIdField] + ' and '
        }
      }
    })
    return oIdQueryString
  }

  selectFeatureForProfiling = (feature) => {
    let addAtFirst = false
    let reverse = false
    const graphicsLength = this.drawingLayer.graphics.length
    //if any features is already added then check the new selected one should be added as the first or last in the layer
    if (graphicsLength > 0) {
      const firstGeometry: any = this.drawingLayer.graphics.getItemAt(0).geometry
      const lastGeometry: any = this.drawingLayer.graphics.getItemAt(graphicsLength - 1).geometry

      const oldStartPoint = firstGeometry.getPoint(0, 0)
      const oldEndPoint = lastGeometry.getPoint(0, lastGeometry.paths[0].length - 1)

      const newStartPoint = feature.geometry.getPoint(0, 0)
      const newEndPoint = feature.geometry.getPoint(0, feature.geometry.paths[0].length - 1)

      //Old Start is same as new Start
      if (geometryEngine.intersects(newStartPoint, oldStartPoint)) {
        addAtFirst = true
        reverse = true
        //Old Start is same as new End
      } else if (geometryEngine.intersects(newEndPoint, oldStartPoint)) {
        addAtFirst = true
        reverse = false
        // Old End is same as new End
      } else if (geometryEngine.intersects(newEndPoint, oldEndPoint)) {
        addAtFirst = false
        reverse = true
        // Old End is same as new Start
      } else if (geometryEngine.intersects(newStartPoint, oldEndPoint)) {
        addAtFirst = false
        reverse = false
      }
    }

    const color = new Color(this.state.graphicsHighlightColor ? this.state.graphicsHighlightColor : '#00ffff')
    const rgbaColor = color.toRgba()
    const polylineSymbol = {
      type: 'simple-line',
      color: rgbaColor,
      width: 5
    }
    const polylineGeometry: Polyline = feature.geometry
    //flip the polyline geometry direction to get proper sequence
    if (reverse) {
      const flippedPaths = []
      for (let j = polylineGeometry.paths.length - 1; j >= 0; j--) {
        const arr1 = []
        for (let i = polylineGeometry.paths[j].length - 1; i >= 0; i--) {
          arr1.push(polylineGeometry.paths[j][i])
        }
        flippedPaths.push(arr1)
      }
      polylineGeometry.paths = flippedPaths
    }
    //create new graphic with the newly selected geometry
    const polylineGraphic = new Graphic({
      geometry: polylineGeometry,
      attributes: feature.attributes,
      symbol: polylineSymbol
    })
    let addedToSelection: boolean = false
    //On selecting new feature render the chart
    if (!this.state.addToSelectionTool && this._defaultViewModel) {
      this._defaultViewModel.input = polylineGraphic
      addedToSelection = true
    }

    if (addAtFirst) {
      this.drawingLayer.graphics.add(polylineGraphic, 0)
    } else {
      this.drawingLayer.graphics.add(polylineGraphic)
    }
    //remove previous possible selection and highlight the new nextPossible selection
    this.nextPossibleSelectionLayer.removeAll()
    setTimeout(() => {
      //render chart dynamically on select lines
      this.renderChartOnSelect(addedToSelection)
      this.highlightNextPossibleSelection()
    }, 200)
  }

  //If selected feature have multiple paths then the distance calculations was getting impacted
  //Whenever new feature is selected create its data into on single path and then add in to drawing layer
  createSinglePathPolyline = (polylineGeometry: Polyline) => {
    const singlePath = []
    polylineGeometry.paths.forEach((eachPath) => {
      eachPath.forEach((eachPoint) => singlePath.push(eachPoint))
    })
    // create new merged polyline feature to generate ground profile
    const newPolyLine = new Polyline({
      hasZ: polylineGeometry.hasZ,
      spatialReference: polylineGeometry.spatialReference.toJSON()
    })
    newPolyLine.addPath(singlePath)
    return newPolyLine
  }

  renderChartOnSelect = (graphicAddedToSelection: boolean) => {
    if (this.state.addToSelectionTool) {
      let graphic
      //If selected line features length is more than one then merge them and create one single polyline for generating profile
      //Make union of the selected features by merging points in each path of each feature in to a single path and create only one graphic with one path
      if (this.drawingLayer.graphics.length > 1) {
        // create new merged polyline feature to generate ground profile
        const newPolyLine = new Polyline({
          spatialReference: this.drawingLayer.graphics.getItemAt(0).geometry.spatialReference.toJSON(),
          hasZ: false
        })
        let singlePath = []
        //get geometries of all selected/drawn features and merge to create single polyline with only one path
        //If any line have multiple path keep them as it is, don't merge multiple paths of single line, it will corrupt the geometry
        this.drawingLayer.graphics.forEach((eachFeature) => {
          const eachGeometry: Polyline = eachFeature.geometry as Polyline
          if (eachGeometry.hasZ) {
            newPolyLine.hasZ = true
          }
          //if geometry have multiple paths then add those paths into new polyline directly
          //else add points in single path array
          if (eachGeometry.paths.length > 1) {
            eachGeometry.paths.forEach((eachPath) => {
              if (singlePath.length > 0) {
                eachPath.forEach((eachPoint) => singlePath.push(eachPoint))
                newPolyLine.addPath(singlePath)
                singlePath = []
              } else {
                newPolyLine.addPath(eachPath)
              }
            })
          } else {
            const newLinesPathLength = newPolyLine.paths.length
            if (newLinesPathLength > 0) {
              eachGeometry.paths.forEach((eachPath) => {
                eachPath.forEach((eachPoint) => newPolyLine.paths[newLinesPathLength - 1].push(eachPoint))
              })
            } else {
              eachGeometry.paths.forEach((eachPath) => {
                eachPath.forEach((eachPoint) => singlePath.push(eachPoint))
              })
            }
          }
        })
        if (singlePath.length > 0) {
          newPolyLine.addPath(singlePath)
        }
        graphic = new Graphic({
          geometry: newPolyLine
        })
      } else if (this.drawingLayer.graphics.length === 1) {
        graphic = this.drawingLayer.graphics.getItemAt(0)
      }
      if (!graphicAddedToSelection && this._defaultViewModel) {
        this._defaultViewModel.input = graphic
      }
    }
  }

  highlightNextPossibleSelection = () => {
    let firstPoint: Point, lastPoint: Point, firstGeometry, lastGeometry
    const graphicsLength = this.drawingLayer.graphics.length
    if (graphicsLength > 0) {
      firstGeometry = this.drawingLayer.graphics.getItemAt(0).geometry
      firstPoint = firstGeometry.getPoint(0, 0)
      let lastIdx = firstGeometry.paths[0].length - 1
      lastPoint = firstGeometry.getPoint(0, lastIdx)
      //if more than one graphics then use last point of the last graphics
      if (graphicsLength > 1) {
        lastGeometry = this.drawingLayer.graphics.getItemAt(graphicsLength - 1).geometry
        lastIdx = lastGeometry.paths[0].length - 1
        lastPoint = lastGeometry.getPoint(0, lastIdx)
      }
      const fg = new Graphic({
        geometry: firstPoint
      })
      this.nextPossibleSelectionLayer.graphics.add(fg)
      const lg = new Graphic({
        geometry: lastPoint
      })
      this.nextPossibleSelectionLayer.graphics.add(lg)
      this.queryForNextPossibleSelection([firstPoint, lastPoint])
    }
  }

  queryForNextPossibleSelection = (endPointsGeometry: Point[]) => {
    let defArrResult = []
    endPointsGeometry.forEach((point) => {
      defArrResult = defArrResult.concat(this.queryForIndividualLayers(this.pointToExtent(point)))
    })
    this.setState({
      nextPossibleloadingIndicator: true
    })
    Promise.all(defArrResult).then((results: any) => {
      this.setState({
        nextPossibleloadingIndicator: false
      })
      const nextSelectableFeatures = []
      //Merge all the arrays into a single array
      const combinedResults = results.flat()
      if (combinedResults?.length > 0) {
        combinedResults.forEach((feature) => {
          if (feature?.geometry?.paths?.length > 0) {
            const firstPoint = feature.geometry.getPoint(0, 0)
            const lastIdx = feature.geometry.paths[feature.geometry.paths.length - 1].length - 1
            const lastPoint = feature.geometry.getPoint(0, lastIdx)
            //need to check returned geometries end point is intersecting with one of the endpoint of already selected line
            //since the intersection query will return the lines intersecting in between to the endpoints.
            if ((firstPoint && geometryEngine.intersects(endPointsGeometry[0], firstPoint)) ||
              (lastPoint && geometryEngine.intersects(endPointsGeometry[0], lastPoint)) ||
              (firstPoint && geometryEngine.intersects(endPointsGeometry[1], firstPoint)) ||
              (lastPoint && geometryEngine.intersects(endPointsGeometry[1], lastPoint))) {
              const polylineSymbol = {
                type: 'simple-line',
                color: [252, 252, 3, 0.8],
                style: 'short-dot',
                width: this.state?.jimuMapView?.view?.type === '3d' ? 7 : 4
              }
              const polylineGraphic = new Graphic({
                geometry: feature.geometry,
                attributes: feature.attributes,
                symbol: polylineSymbol
              })
              nextSelectableFeatures.push(polylineGraphic)
            }
          }
        })
        if (nextSelectableFeatures && nextSelectableFeatures.length > 0) {
          this.nextPossibleSelectionLayer.graphics.addMany(nextSelectableFeatures)
        }
      }
      setTimeout(() => {
        this.updateStateCanAddToSelection()
      }, 200)
    }, (err) => {
      console.log(err)
      this.updateStateCanAddToSelection()
    })
  }

  updateStateCanAddToSelection = () => {
    this.state.currentSketchVM?.cancel()
    //based on possible next selection show or hide the addToSelection tool
    const results = this.nextPossibleSelectionLayer.graphics.filter((graphic) => {
      return graphic.geometry.type === 'polyline'
    })
    let newState: boolean = false
    if (results.length > 0) {
      newState = true
    } else {
      if (this.newFeatureSelection) {
        this.setState({
          noGraphicAfterFirstSelection: true
        })
      } else {
        this.setState({
          noGraphicAfterFirstSelection: false
        })
      }
    }
    if (newState) {
      this._activateAddToSelectionTool()
    } else {
      this._deActivateAddToSelectionTool()
    }
  }

  _activateAddToSelectionTool = () => {
    if (!this.state.addToSelectionTool) {
      this.setState({
        addToSelectionTool: true
      })
    }

    if (this.state.jimuMapView && this.state.jimuMapView.view) {
      this.state.jimuMapView.view.popupEnabled = false
    }
    this._displayAddToSelectionCursor()
    this.nextPossibleSelectionLayer?.set('visible', true)
  }

  _deActivateAddToSelectionTool = () => {
    if (this.state.addToSelectionTool) {
      this.setState({
        addToSelectionTool: false
      })
    }
    if (this.state.jimuMapView && this.state.jimuMapView.view) {
      this.state.jimuMapView.view.popupEnabled = true
    }
    this._displayDefaultCursor()
    this.nextPossibleSelectionLayer?.set('visible', false)
  }

  _displayAddToSelectionCursor = () => {
    if (this.state.jimuMapView && this.state.jimuMapView.view) {
      if (this.state.jimuMapView.view && this.state.jimuMapView.view.container &&
        this.state.jimuMapView.view.container.style.cursor !== null) {
        this.state.jimuMapView.view.container.style.cursor = 'copy'
      }
    }
  }

  activateDrawOrSelectTool = () => {
    //Check for a valid sketch modal and then do the further processing
    if (this.state.currentSketchVM) {
      //Cancel sketchVM if newSelection or drawTool is active
      if (this.state.drawModeActive || this.state.selectModeActive) {
        this.state.currentSketchVM.cancel()
      }
      this.setState({
        onDrawingComplete: false,
        startChartRendering: false,
        viewModelErrorState: false,
        loadingIndicator: false
      }, () => {
        //Activate draw tool
        if (this.state.drawModeActive) {
          if (this._defaultViewModel) {
            if(this._drawTool){
              this.poledrawAction = this._drawTool.create("polyline");
              this.poledrawAction.on('vertex-add', this.addPolelineGraphic);
              this.poledrawAction.on('cursor-update', this.addPolelineGraphic);
              this.poledrawAction.on('draw-complete', this.addPolelineGraphic);
            }
              
           // this.mapView.focus();
           // this._defaultViewModel.start({ mode: 'sketch' })
          }
        }
        //Activate select tool
        if (this.state.selectModeActive) {
          this.state.currentSketchVM.create('point')
        }
      })
    }
  }

  destroyDrawingLayers = () => {
    if (this.drawingLayer) {
      this.drawingLayer.removeAll()
      this.drawingLayer.destroy()
    }
    if (this.poleDrawingLayer) {
      this.poleDrawingLayer.removeAll()
      this.poleDrawingLayer.destroy()
    }
    if (this.poleactiveDrawingLayer) {
      this.poleactiveDrawingLayer.removeAll()
      this.poleactiveDrawingLayer.destroy()
    }
    
    if (this.nextPossibleSelectionLayer) {
      this.nextPossibleSelectionLayer.removeAll()
      this.nextPossibleSelectionLayer.destroy()
    }
    if (this.bufferLayer) {
      this.bufferLayer.removeAll()
      this.bufferLayer.destroy()
    }
    if (this.intersectionHighlightLayer) {
      this.intersectionHighlightLayer.removeAll()
      this.intersectionHighlightLayer.destroy()
    }
    this.hideChartPosition()
  }

  _displayDefaultCursor = () => {
    if (this.state.jimuMapView && this.state.jimuMapView.view) {
      if (this.state.jimuMapView.view && this.state.jimuMapView.view.container &&
        this.state.jimuMapView.view.container.style.cursor !== null) {
        this.state.jimuMapView.view.container.style.cursor = null
      }
    }
  }

  pointToExtent = (point, pixelTolerance: number = 5): Extent => {
    //calculate map coords represented per pixel
    const viewExtentWidth: number = this.state.jimuMapView.view.extent.width
    const viewWidth: number = this.state.jimuMapView.view.width
    const pixelWidth = viewExtentWidth / viewWidth
    //calculate map coords for tolerance in pixel
    const toleranceInMapCoords: number = pixelTolerance * pixelWidth
    //calculate & return computed extent
    const areaExtent = {
      xmin: (point.x - toleranceInMapCoords),
      ymin: (point.y - toleranceInMapCoords),
      xmax: (point.x + toleranceInMapCoords),
      ymax: (point.y + toleranceInMapCoords),
      spatialReference: this.state.jimuMapView.view.spatialReference
    }
    return new Extent(areaExtent)
  }

  selectableLayersAvailableAtRuntime = (layers: string[]) => {
    this.selectableLayersAtRuntime = layers
    this.isSelectableLayersChangedAtRuntime = true
  }

  intersectingLayersAvailableAtRuntime = (layers: string[]) => {
    this.intersectingLayersAtRuntime = layers
    if (this.resultsAfterIntersectionTimeout) {
      clearTimeout(this.resultsAfterIntersectionTimeout)
    }
    this.resultsAfterIntersectionTimeout = setTimeout(() => {
      this.resultsAfterIntersectionTimeout = null
      this.createBufferGraphics()
    }, 500)
  }

  onSelectButtonClicked = () => {
    this.setState({
      initialStage: false,
      resultStage: true,
      selectModeActive: true,
      drawModeActive: false
    }, () => {
      this.activateDrawOrSelectTool()
    })
  }

  onDrawButtonClicked = () => {
    this.setState({
      initialStage: false,
      resultStage: true,
      selectModeActive: false,
      drawModeActive: true
    }, () => {
      this.activateDrawOrSelectTool()
    })
  }

  onBackClick = () => {
    this.clearAll()
    this.getSelectableLayers(this.state.currentDatasource)
    this.setState({
      initialStage: true,
      startChartRendering: false,
      onDrawingComplete: false,
      resultStage: false,
      drawModeActive: false,
      selectModeActive: false
    })
  }

  clearAll = (skipClearingSelectedFeatures?: boolean) => {
    if (this._defaultViewModel) {
      this._defaultViewModel.clear()
    }
    if (this.state.drawModeActive || this.state.selectModeActive) {
      this.state.currentSketchVM?.cancel()
    }
    this._deActivateAddToSelectionTool()
    this.clearGraphics()
    !skipClearingSelectedFeatures && this.mapView.clearSelectedFeatures()
    this.clearChart()
  }

  clearGraphics = () => {
    //remove drawn, chartPosition, selected and nextPossible selection graphics layer
    if (this.drawingLayer) {
      this.drawingLayer.removeAll()
    }
    if (this.poleDrawingLayer) {
      this.poleDrawingLayer.removeAll()
    }
    if (this.poleactiveDrawingLayer) {
      this.poleactiveDrawingLayer.removeAll()
    }
    if (this.nextPossibleSelectionLayer) {
      this.nextPossibleSelectionLayer.removeAll()
    }
    if (this.bufferLayer) {
      this.bufferLayer.removeAll()
    }
    if (this.intersectionHighlightLayer) {
      this.intersectionHighlightLayer.removeAll()
    }
    this.hideChartPosition()
  }

  clearChart = () => {
    //clear profile result, which will result in clearing the chart
    this.setState({
      profileResult: null,
      noFeaturesError: false
    }, () => {
      this.buildStatsValuesAsOutput(this.state.profileResult, this.props.outputDataSources?.[0], '', '', false)
    })
  }

  activateToolForNewProfile = () => {
    //Clear all the previous chart and graphics and create New Profile
    this.clearAll()
    this.setState({
      initialStage: false,
      resultStage: true
    }, () => {
      this.activateDrawOrSelectTool()
    })
  }

  onDoneButtonCLicked = (): boolean => {
    let enableNewProfileOption: boolean = false
    this._defaultViewModel.stop()
    if (this._defaultViewModel.state === 'created' || this._defaultViewModel.state === 'selected') {
      enableNewProfileOption = true
    }
    if (enableNewProfileOption) {
      this.stopFurtherSelectingLines()
    } else {
      this.activateDrawOrSelectTool()
    }
    return enableNewProfileOption
  }

  stopFurtherSelectingLines = () => {
    this._deActivateAddToSelectionTool()
    if (this.nextPossibleSelectionLayer) {
      this.nextPossibleSelectionLayer.removeAll()
    }
  }

  highlightChartPosition = (x) => {
    if (this._defaultViewModel) {
      this._defaultViewModel.hoveredChartPosition = x
    }
  }

  hideChartPosition = () => {
    if (this._defaultViewModel) {
      this._defaultViewModel.hoveredChartPosition = null
    }
  }

  onViewsCreate = (views: { [viewId: string]: JimuMapView }) => {
    this.setState({
      isMapLoaded: true
    })
  }

  renderFrontLandingPage = () => {
    return (
      <div tabIndex={-1} className={'h-100 w-100 d-flex align-items-center mainSection'}>
        <div tabIndex={-1} className={'adjust-cards'}>
          <Card tabIndex={0} aria-label={this.nls('selectLinesDesc')} button data-testid='selectButton'
            className={classNames('front-cards mt-4 mb-4 shadow', this.state.currentDatasource === 'default' || this.state.lineLayersNotFound ? 'hidden' : 'front-section')}
            onClick={this.onSelectButtonClicked} onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                this.onSelectButtonClicked()
              }
            }}>
            <CardBody className={'w-100 h-100 p-4'}>
              <h5 className={'text-truncate'} style={{ textAlign: 'center' }}>{this.nls('selectLinesLabel')}</h5>
              <p title={this.nls('selectLinesDesc')} className={'m-4 userGuideInfo'}>
                {this.nls('selectLinesDesc')}
              </p>
              <div style={{ textAlign: 'center' }}>
                <Button role={'button'} aria-label={this.nls('selectButtonLabel')} title={this.nls('selectButtonLabel')}
                  size={'default'} type='secondary' className={'text-break'}>
                  {this.props.config.generalSettings?.buttonStyle === ButtonTriggerType.IconText &&
                    <React.Fragment>
                      <Icon size='12' icon={epIcon.selectIcon} />
                      {this.nls('selectButtonLabel')}
                    </React.Fragment>
                  }
                </Button>
              </div>
            </CardBody>
          </Card>
        {/* {   added below div by krishna for pole checkbox} */}
          <div>
                <Label
                  centric
                >
                  <Checkbox
                    aria-label="Checkbox"
                    checked ={this.state.polecheckboxChanged}
                    className="mr-2"
                    onChange={() => {  this.setState((prevState) => ({
                      polecheckboxChanged: !prevState.polecheckboxChanged, // Toggle the boolean value
                    })); }}
                  />
                  Pole Intersect
                </Label>
              </div>
          <Card tabIndex={0} aria-label={this.nls('drawProfileDesc')} button data-testid='drawButton'
            className={classNames('front-cards front-section mt-4 mb-4 shadow', this.state.currentDatasource === 'default' || this.state.lineLayersNotFound ? 'h-100 ' : '')}
            onClick={this.onDrawButtonClicked} onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                this.onDrawButtonClicked()
              }
            }}>
            <CardBody className={'w-100 h-100 p-4'}>
              <h5 className={'text-truncate'} style={{ textAlign: 'center' }}>{this.nls('drawProfileLabel')}</h5>
              <p title={this.nls('drawProfileDesc')} className={'m-4 userGuideInfo'}>
                {this.nls('drawProfileDesc')}
              </p>
              <div style={{ textAlign: 'center' }}>
                <Button role={'button'} aria-label={this.nls('drawButtonLabel')} title={this.nls('drawButtonLabel')}
                  size={'default'} type='secondary' className={'text-break'}>
                  {this.props.config.generalSettings?.buttonStyle === ButtonTriggerType.IconText &&
                    <React.Fragment>
                      <Icon size='12' icon={epIcon.drawIcon} />
                      {this.nls('drawButtonLabel')}
                    </React.Fragment>
                  }
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    )
  }

  resetToDefault = () => {
    //clears the output data source statistics
    this.buildStatsValuesAsOutput(null, this.props.outputDataSources?.[0], this.state.selectedElevationUnit, this.state.selectedLinearUnit, false)
    if (this.state.drawModeActive || this.state.selectModeActive) {
      this.state.currentSketchVM?.cancel()
    }
    if (this._defaultViewModel) {
      this._defaultViewModel.clear()
    }
    this.clearGraphics()
    this._displayDefaultCursor()
  }

  render () {
    const frontPage = this.renderFrontLandingPage()
    let jmc
    const useMapWidget = this.props.useMapWidgetIds &&
                         this.props.useMapWidgetIds[0]
    // If the user has selected a map, include JimuMapViewComponent.
    if (this.props.hasOwnProperty('useMapWidgetIds') &&
      this.props.useMapWidgetIds &&
      this.props.useMapWidgetIds.length === 1) {
      jmc = <JimuMapViewComponent
        useMapWidgetId={this.props.useMapWidgetIds[0]} onActiveViewChange={this.activeViewChangeHandler.bind(this)}
        onViewsCreate={this.onViewsCreate} />
    }

    //If map widget is not available or deleted then widget should revert to placeholder instantly
    if (!useMapWidget) {
      this.resetToDefault()
      return (
        <WidgetPlaceholder
          icon={epIcon.elevationIcon} widgetId={this.props.id} data-testid={'widgetPlaceholder'}
          message={this.props.intl.formatMessage({ id: '_widgetLabel', defaultMessage: this.nls('_widgetLabel') })}
        />
      )
    }
    let dsToGetSelectedOnLoad = null
    if (this.state.dsToGetSelectedOnLoad && this.props.useDataSources?.length) {
      dsToGetSelectedOnLoad = this.props.useDataSources?.filter((ds) => ds.dataSourceId === this.state.dsToGetSelectedOnLoad)
      dsToGetSelectedOnLoad = dsToGetSelectedOnLoad.length > 0 ? dsToGetSelectedOnLoad[0] : null
    }
    return (
      <div css={getStyle(this.props.theme)} className='jimu-widget'>
        <div className='widget-elevation-profile'>
          {!this.state.layersLoaded &&
            <React.Fragment >
              <Loading type={LoadingType.Donut} />
              <p className='loading-text pt-2'>{this.nls('mapLoadingMsg')}</p>
            </React.Fragment>
          }
          {this.state.layersLoaded && this.state.onWidgetLoadShowLoadingIndicator && this.state.isMapLoaded &&
            <Loading type={LoadingType.Donut} />
          }
          {jmc}
          {dsToGetSelectedOnLoad &&
            <DataSourceComponent
              useDataSource={dsToGetSelectedOnLoad}
              onDataSourceInfoChange={this.onDataSourceInfoChange}
              widgetId={this.props.id}
            />
          }
          {!this.state.onWidgetLoadShowLoadingIndicator && this.state.initialStage &&
            frontPage
          }
          {!this.state.onWidgetLoadShowLoadingIndicator && this.state.resultStage &&
            <ResultPane
              theme={this.props.theme}
              intl={this.props.intl}
              widgetId={this.props.id}
              displayLoadingIndicator={this.state.loadingIndicator || this.state.nextPossibleloadingIndicator}
              activeDataSource={this.state.currentDatasource}
              commonDsGeneralSettings={this.props.config.generalSettings}
              defaultConfig={this.defaultConfig}
              activeDatasourceConfig={this.props.config.configInfo[this.state.currentDatasource]}
              profileResult={this.state.profileResult}
              intersectionResult={this.state.intersectionResult}
              visibleGroundProfileStats={this._defaultViewModel?.visibleProfiles?.[0]}
              selectMode={this.state.selectModeActive}
              drawMode={this.state.drawModeActive}
              onDrawingComplete={this.state.onDrawingComplete}
              isNewSegmentsForSelection={this.state.addToSelectionTool}
              noGraphicAfterFirstSelection={this.state.noGraphicAfterFirstSelection}
              chartRender={this.state.startChartRendering}
              chartColorRender={this.state.chartColorRender}
              noFeaturesFoundError={this.state.noFeaturesError}
              onNavBack={this.onBackClick}
              doneClick={this.onDoneButtonCLicked}
              activateDrawSelectToolForNewProfile={this.activateToolForNewProfile}
              selectableLayersRuntime={this.selectableLayersAvailableAtRuntime}
              intersectingLayersRuntime={this.intersectingLayersAvailableAtRuntime}
              chartPosition={this.highlightChartPosition}
              hideChartPosition={this.hideChartPosition}
              buildOutputStatistics={this.buildOutputStatistics}
              intersectingBufferRuntime={this.onBufferChange}
              drawingLayer={this.drawingLayer}
              intersectionHighlightLayer={this.intersectionHighlightLayer}
              jimuMapView={this.state.jimuMapView}
              viewModelErrorState={this.state.viewModelErrorState}
              profileErrorMsg={this.state.profileErrorMsg}
              chartDataUpdateTime={this.state.chartDataUpdateTime}
              currentPageId={this.props.currentPageId}
            />
          }
        </div >
      </div>
    )
  }
}
