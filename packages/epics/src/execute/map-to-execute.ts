/**
 * The epics in this file are responsible for mapping UI-based
 * execution action, like EXECUTE_CELL or EXECUTE_FOCUSED_CELL, to
 * a single SEND_EXECUTE_REQUEST action that the core execution epics
 * listen to.
 */
import Immutable from "immutable";
import { ActionsObservable, StateObservable, ofType } from "redux-observable";
import { of } from "rxjs";
import { concatMap, mergeMap } from "rxjs/operators";

import * as actions from "@nteract/actions";
import { CellId } from "@nteract/commutable";
import * as selectors from "@nteract/selectors";
import { AppState, KernelStatus, errors } from "@nteract/types";

/**
 * Maps ExecuteAllCells and ExecuteAllCellsBelow actions to
 * ExecuteCell actions. These ExecuteCell actions are mapped
 * to SendExecuteRequest actions by another epic.
 *
 * @param action$  The stream of actions dispatched to Redux
 * @param state$   The stream of state changes
 */
export function executeAllCellsEpic(
  action$: ActionsObservable<
    actions.ExecuteAllCells | actions.ExecuteAllCellsBelow
  >,
  state$: StateObservable<AppState>
) {
  return action$.pipe(
    ofType(actions.EXECUTE_ALL_CELLS, actions.EXECUTE_ALL_CELLS_BELOW),
    concatMap(
      (action: actions.ExecuteAllCells | actions.ExecuteAllCellsBelow) => {
        const state = state$.value;
        const contentRef = action.payload.contentRef;

        const model = selectors.model(state, { contentRef });
        // If it's not a notebook, we shouldn't be here
        if (!model || model.type !== "notebook") {
          return of(
            actions.executeFailed({
              error: new Error(
                "Cannot send execute requests from non-notebook files."
              ),
              code: errors.EXEC_NOT_A_NOTEBOOK,
              contentRef
            })
          );
        }

        let codeCellIds = Immutable.List();

        if (action.type === actions.EXECUTE_ALL_CELLS) {
          codeCellIds = selectors.notebook.codeCellIds(model);
        } else if (action.type === actions.EXECUTE_ALL_CELLS_BELOW) {
          codeCellIds = selectors.notebook.codeCellIdsBelow(model);
        }
        return of(
          ...codeCellIds.map((id: CellId) =>
            actions.executeCell({ id, contentRef: action.payload.contentRef })
          )
        );
      }
    )
  );
}

/**
 * Maps an ExecuteFocusedCell action to an ExecuteCell action
 * by extracting the currently focused cell from the state.
 *
 * @param action$
 * @param state$
 */
export function executeFocusedCellEpic(
  action$: ActionsObservable<actions.ExecuteFocusedCell>,
  state$: StateObservable<AppState>
) {
  return action$.pipe(
    ofType(actions.EXECUTE_FOCUSED_CELL),
    mergeMap((action: actions.ExecuteFocusedCell) => {
      const contentRef = action.payload.contentRef;
      const state = state$.value;
      const model = selectors.model(state, { contentRef });
      // If it's not a notebook, we shouldn't be here
      if (!model || model.type !== "notebook") {
        return of(
          actions.executeFailed({
            error: new Error(
              "Cannot send execute requests from non-notebook files."
            ),
            code: errors.EXEC_NOT_A_NOTEBOOK,
            contentRef
          })
        );
      }

      const id = model.cellFocused;

      if (!id) {
        return of(
          actions.executeFailed({
            error: new Error("There is currently no focused cell to execute."),
            code: errors.EXEC_NO_CELL_WITH_ID,
            contentRef: action.payload.contentRef
          })
        );
      }

      /* Retirieve cell for contentRef to check if it is executable */
      const cell = selectors.notebook.cellById(model, {
        id
      });

      // RID:JK almost the same check as in sendExecuteRequestEpic
      // but don't raise errors. Not sure if executeCanceled
      // is used right here, but the point is returns
      // something that is not an actions.executeFailed()
      /**
       * Only code cells can be executed, cancel execution
       * if an attempt to execute a non-code cell is made.
       * Avoid raising EXEC_INVALID_CELL_TYPE
       */
      if (
        cell.get("cell_type", null) === "markdown" ||
        cell.get("cell_type", null) === "raw" ||
        !cell.get("cell_type", null)
      ) {
        return of(
          // RID:JK:
          actions.executeCanceled({
            contentRef,
            id
          })
        );
      }

      /**
       * We cannot execute cells with no content, cancel the
       * execution what that is the case
       * Avoid raising EXEC_NO_SOURCE_ERROR
       */
      const source = cell.get("source", "");
      if (source === "") {
        return of(
          actions.executeCanceled({
            contentRef,
            id
          })
        );
      }



      return of(
        actions.executeCell({ id, contentRef: action.payload.contentRef })
      );
    })
  );
}

/**
 * Maps an ExecuteCell action to a SendExecuteRequest or EnqueueAction action.
 *
 * If the kernel is ready to execute, emit the SendExecuteRequest action.
 *
 * F f the kernel is not ready, push the execute request to the message queue
 * by emitting the EnqueueAction action.
 */
export function executeCellEpic(
  action$: ActionsObservable<actions.ExecuteCell>,
  state$: StateObservable<AppState>
) {
  return action$.pipe(
    ofType(actions.EXECUTE_CELL),
    mergeMap((action: actions.ExecuteCell) => {
      const state = state$.value;
      const contentRef = action.payload.contentRef;
      const kernel = selectors.kernelByContentRef(state, { contentRef });

      if (
        kernel &&
        kernel.channels &&
        kernel.status !== KernelStatus.NotConnected &&
        kernel.status !== KernelStatus.ShuttingDown
      ) {
        return of(actions.sendExecuteRequest(action.payload));
      } else {
        return of(
          actions.updateCellStatus({ ...action.payload, status: "queued" }),
          actions.enqueueAction(action.payload)
        );
      }
    })
  );
}
