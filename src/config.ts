import { type DataRecord, type ImmutableObject } from 'jimu-core'
import { type JimuPolygonSymbol } from 'jimu-ui/advanced/map'

export interface Config {
  useMapWidget: boolean
  activeDataSource: string
  generalSettings: GeneralSetting
  configInfo: any
}

export interface ProfileChart {
  isCustomElevationLayer: boolean
  elevationLayerURL: string
  linearUnit: string
  elevationUnit: string
  displayStatistics: boolean
  selectedStatistics: Statistics[]
  groundColor: string
  graphicsHighlightColor: string
  showVolumetricObjLineInGraph: boolean
  volumetricObjLineColor: string
  volumetricObjLabel: string
}

export interface ProfileSettings {
  isProfileSettingsEnabled: boolean
  isCustomizeOptionEnabled: boolean
  layers: ProfileLayersSettings[]
}

export interface AssetSettings {
  isAssetSettingsEnabled: boolean
  layers: AssetLayersSettings[]
  assetIntersectingBuffer: AssetBufferIntersection
}

export interface GeneralSetting {
  allowExport: boolean
  isSelectToolActive: boolean
  isDrawToolActive: boolean
  showGridAxis: boolean
  showAxisTitles: boolean
  showLegend: boolean
  buttonStyle: string
}

export interface Statistics {
  enabled: boolean
  name: string
  label: string
}

export interface ProfileLayersSettings {
  layerId: string
  elevationSettings: ElevationSettings
  distanceSettings: {
    type: string
    field: string
    unit: string
  }
  style: ProfileStyle
}

interface ElevationSettings {
  type: string
  unit: string
  field1: string
  field2: string
}

export interface AssetLayersSettings {
  layerId: string
  elevationSettings: ElevationSettings
  displayField: string
  style: AssetStyle
}

export interface AssetBufferIntersection {
  enabled: boolean
  bufferDistance: number
  bufferUnits: string
  bufferSymbol: JimuPolygonSymbol
}

export enum ButtonTriggerType {
  IconText = 'ICONTEXT'
}

export interface ProfileStyle {
  lineType: string
  lineColor: string
  lineThickness: number
}

export interface AssetStyle {
  type: string
  intersectingAssetShape: string
  intersectingAssetSize: number
  intersectingAssetColor: string
}

export interface ElevationType {
  value: string
  name: string
}

export interface LayerIntersectionInfo {
  title: string
  intersectionResult: IntersectionResult []
  inputGeometry: __esri.Geometry
  settings: AssetLayersSettings
}
export interface IntersectionResult {
  record: DataRecord
  intersectingFeature: __esri.Graphic
  disconnectedFeatureForProfiling: __esri.Point[]
  connectedFeatureForProfiling: __esri.Geometry[]
}

export interface StatisticsAttributes {
  [key: string]: any
}

export type IMConfig = ImmutableObject<Config>
