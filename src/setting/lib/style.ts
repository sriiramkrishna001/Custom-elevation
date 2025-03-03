import { type IMThemeVariables, css, type SerializedStyles, polished, getAppStore } from 'jimu-core'

export function getStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    .widget-setting-elevation-profile {
      height: 100%;

      .map-selector-section .component-map-selector .form-control {
        width: 100%;
      }
      
      .hidden {
        display: none;
      }
      
      .jimu-tree {
        width: 100%;
      }

      .data-item {
        display: flex;
        flex: 1;
        padding: 0.5rem 0.6rem;
        line-height: 23px;
        cursor: pointer;

        .data-item-name {
          word-break: break-word;
        }
      }

      .warningMsg {
        padding: 0.25rem!important;
        margin-top: -7px;
      }

      .warningMsg .left-part {
        margin-right: 0 !important;
      }

      .color-label {
        color: ${theme.ref.palette.neutral[900]};
      }

      .ep-tooltip {
        margin-right: 0.30rem!important;
      }

      .ep-section-title {
        color: var(--ref-palette-neutral-1100);
      }

      .mapSettingsHint {
        color: var(--ref-palette-neutral-1000);
        font-size: ${polished.rem(13)};
      }

      .placeholder-container {
        height: calc(100% - 180px);

        .placeholder {
          flex-direction: column;

          .icon {
            color: var(--ref-palette-neutral-800);
          }

          .hint {
            font-size: ${polished.rem(14)};
            font-weight: 500;
            color: var(--ref-palette-neutral-1000);
            max-width: ${polished.rem(160)};
          }
        }
      }
    }
  `
}

export function getProfileChartStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    .selectOption {
      width: 114px;
    }

    .color-label {
      color: ${theme.ref.palette.neutral[900]};
    }

    .hidden {
      display: none;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .disabled-label{
      color: ${theme.ref.palette.neutral[700]};
    }

    .ep-tooltip {
      margin-right: 0.30rem!important;
    }

    .ep-divider-top {
      border-top: 1px solid var(--ref-palette-neutral-700)
    }
  `
}

export function getPopupStyle (theme: IMThemeVariables): SerializedStyles {
  const isRTL = getAppStore().getState().appContext.isRTL

  return css`
    .popupContents {
      width: 450px;
    }

    .alertValidationContent{
      height: 42px;
    }

    .invalidServiceURL {
      display: block;
    }

    .validServiceURL {
      display: none;
    }

    .elevationErrorMessage {
      padding-top: 5px;
      color: ${theme.sys.color.error.main};
      font-weight: bold;
    }

    .elevationUrlTextInput .input-wrapper input {
      padding: ${isRTL ? '0 1px' : '0'};
    }
  `
}

export function getStyleForLI (theme: IMThemeVariables): SerializedStyles {
  return css`
    .layer-item-panel {
      .setting-header {
        padding: ${polished.rem(10)} ${polished.rem(16)} ${polished.rem(0)} ${polished.rem(16)}
      }
      .setting-title {
        font-size: ${polished.rem(16)};
        .layer-item-label{
          color: ${theme.ref.palette.neutral[1000]};
        }
      }
      .setting-container {
        height: calc(100% - ${polished.rem(50)});
        overflow: auto;

        .title-desc {
          color: ${theme.ref.palette.neutral[800]};
        }

        .ep-divider-bottom {
          border-bottom: 1px solid var(--ref-palette-neutral-700)
        }
  
        .ep-divider-hide {
          border-bottom: none !important
        }

        .ep-section-title {
          max-width: 80%;
          color: var(--ref-palette-neutral-1100);
        }

        .color-label {
          color: ${theme.ref.palette.neutral[900]};
        }

        .cursor-pointer {
          cursor: pointer;
        }
      }
    }
  `
}

export function getAdvanceSettingsStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    .hidden {
      display: none;
    }

    .color-label {
      color: ${theme.ref.palette.neutral[900]};
    }

    .hint {
      font-style: italic;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .fieldSelectorWidth {
      max-width: 110px;
    }
  
    .fieldLabel {
      width: 93px;
    }

    .selectOption {
      width: 110px;
    }

    .warningMsg {
      width: auto;
    }

    .ep-label {
      max-width: 80%;
      display: inline-block;
      margin-bottom: 0;
      margin-right: 20px;
    }

    .jimu-widget-setting--row-label:not(.form-inline) {
      max-width: none;
    }

    .ep-layers-list {
      width: 100%;

      .layer-data-item {
        display: flex;
        flex: 1;
        padding: ${polished.rem(7)} 0.25rem;
        cursor: pointer;
  
        .layer-data-item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          word-break: break-word;
          -webkit-line-clamp: 2;
          padding: 2px;
          line-height: 1.3;
        }
      }
    }

    .ep-data-source-selector {
      .ds-item {
        display: none;
      }
    }

    .tooltip-color {
      color: var(--ref-palette-neutral-1100);
    }

    .ep-divider-top {
      border-top: 1px solid var(--ref-palette-neutral-700)
    }
  `
}

export function getSidePanelStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    position: absolute;
    top: 0;
    bottom: 0;
    width: 259px;
    height: 100%;
    padding-bottom: 1px;
    border-right: 1px solid ${theme.ref.palette.white};
    border-bottom: 1px solid ${theme.ref.palette.white};

    .setting-container {
      height: calc(100% - ${polished.rem(50)});
      overflow: auto;
    }
`
}

export function getGeneralSettingsStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    .hidden {
      display: none;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .ep-tooltip {
      margin-right: 0.30rem!important;
    }
  `
}

export function getStatisticsListStyle (theme: IMThemeVariables): SerializedStyles {
  return css`
    .color-label {
      color: ${theme.ref.palette.neutral[900]};
    }

    .ep-statistics-list-items {
      flex: 1;
      max-height: 215px;
      overflow-y: auto;

      .jimu-tree-item [data-dndzone-droppable=true] {
        border: 1px solid transparent;
      }

      .jimu-tree-item.jimu-tree-item_dnd-true {
        height: auto;
        padding-top: 0rem;

        .jimu-tree-item__body {
          padding: 8px 0px 8px 0px;
        }
      }
    }
  `
}
