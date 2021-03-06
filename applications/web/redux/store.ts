import Immutable from "immutable";
import { compose } from "redux";

import {
  AppState,
  ContentRecord,
  createKernelspecsRef,
  epics as coreEpics,
  HostRecord,
  makeAppRecord,
  makeCommsRecord,
  makeContentsRecord,
  makeEntitiesRecord,
  makeHostsRecord,
  makeStateRecord,
  makeTransformsRecord,
  reducers
} from "@nteract/core";
import { notifications } from "@nteract/mythic-notifications";
import { makeConfigureStore } from "@nteract/myths";
import { Media } from "@nteract/outputs";
import { contents } from "rx-jupyter";

const kernelspecsRef = createKernelspecsRef();

const composeEnhancers =
  typeof window !== "undefined"
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : compose;

export const initialState: AppState = {
  app: makeAppRecord({
    version: "@nteract/web"
  }),
  comms: makeCommsRecord(),
  config: Immutable.Map({
    theme: "light"
  }),
  core: makeStateRecord({
    currentKernelspecsRef: kernelspecsRef,
    entities: makeEntitiesRecord({
      hosts: makeHostsRecord({
        byRef: Immutable.Map<string, HostRecord>()
      }),
      contents: makeContentsRecord({
        byRef: Immutable.Map<string, ContentRecord>()
      }),
      transforms: makeTransformsRecord({
        displayOrder: Immutable.List([
          "application/json",
          "application/javascript",
          "text/html",
          "text/markdown",
          "text/latex",
          "image/svg+xml",
          "image/gif",
          "image/png",
          "image/jpeg",
          "text/plain"
        ]),
        byId: Immutable.Map({
          "application/json": Media.Json,
          "application/javascript": Media.JavaScript,
          "text/html": Media.HTML,
          "text/markdown": Media.Markdown,
          "text/latex": Media.LaTeX,
          "image/svg+xml": Media.SVG,
          "image/gif": Media.Image,
          "image/png": Media.Image,
          "image/jpeg": Media.Image,
          "text/plain": Media.Plain
        })
      })
    })
  })
};

const configureStore = makeConfigureStore<AppState>()({
  packages: [notifications],
  reducers: {
    app: reducers.app,
    comms: reducers.comms,
    config: reducers.config,
    core: reducers.core as any
  },
  epics: coreEpics.allEpics,
  epicDependencies: { contentProvider: contents.JupyterContentProvider },
  enhancer: composeEnhancers
});

export default () => configureStore(initialState);
