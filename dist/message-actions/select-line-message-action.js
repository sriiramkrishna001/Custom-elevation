System.register(["jimu-core"],(function(e,t){var r={};return{setters:[function(e){r.AbstractMessageAction=e.AbstractMessageAction,r.DataSourceManager=e.DataSourceManager,r.Immutable=e.Immutable,r.MessageType=e.MessageType,r.MutableStoreManager=e.MutableStoreManager,r.getAppStore=e.getAppStore}],execute:function(){e((()=>{"use strict";var e={79244:e=>{e.exports=r}},t={};function o(r){var n=t[r];if(void 0!==n)return n.exports;var a=t[r]={exports:{}};return e[r](a,a.exports,o),a.exports}o.d=(e,t)=>{for(var r in t)o.o(t,r)&&!o.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},o.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),o.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})};var n={};return(()=>{o.r(n),o.d(n,{default:()=>t,getDsByWidgetId:()=>r});var e=o(79244);class t extends e.AbstractMessageAction{filterMessageDescription(t){if(t.messageType===e.MessageType.DataRecordsSelectionChange){const o=e.DataSourceManager.getInstance(),n=r(t.widgetId,t.messageType);return null==n?void 0:n.some((e=>{const t=o.getDataSource(e.dataSourceId);return!(!t||"WEB_MAP"!==t.type&&"WEB_SCENE"!==t.type&&("FEATURE_LAYER"!==t.type||"esriGeometryPolyline"!==t.getGeometryType()))}))}}filterMessageType(t){return t===e.MessageType.DataRecordsSelectionChange}filterMessage(e){var t;if((null===(t=null==e?void 0:e.records)||void 0===t?void 0:t.length)>0){const t=null==e?void 0:e.records.filter((e=>{var t,r;return"polyline"===(null===(r=null===(t=null==e?void 0:e.feature)||void 0===t?void 0:t.geometry)||void 0===r?void 0:r.type)}));return t.length>0}return!1}onExecute(t){const r=t;return e.MutableStoreManager.getInstance().updateStateValue(this.widgetId,"selectedFeatureRecords",r.records),!0}getSettingComponentUri(e,t){return null}}function r(t,r){var o;const n=function(){var t,r,o;return window.jimuConfig.isBuilder?null===(r=null===(t=(0,e.getAppStore)().getState())||void 0===t?void 0:t.appStateInBuilder)||void 0===r?void 0:r.appConfig:null===(o=(0,e.getAppStore)().getState())||void 0===o?void 0:o.appConfig}(),a=null===(o=null==n?void 0:n.widgets)||void 0===o?void 0:o[t];return(null==a?void 0:a.useDataSources)||(0,e.Immutable)([])}})(),n})())}}}));