"use client";

import { Alg } from "cubing/alg";
import { TwistyPlayer } from "cubing/twisty";
import { useAction } from "next-safe-action/hooks";
import { useContext, useEffect, useRef, useState } from "react";
import Button from "~/app/components/UI/Button.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import { MainContext } from "~/helpers/contexts.ts";
import { type NxNMove, nxnMoves } from "~/helpers/types/NxNMove.ts";
import { getActionError, getIsWebglSupported } from "~/helpers/utilityFunctions.ts";
import type { CollectiveSolutionResponse } from "~/server/db/schema/collective-solutions.ts";
import {
  makeCollectiveCubingMoveSF,
  startNewCollectiveCubingSolutionSF,
} from "~/server/serverFunctions/serverFunctions.ts";

type Props = {
  initCollectiveSolution: CollectiveSolutionResponse | null;
};

function CollectiveCubing({ initCollectiveSolution }: Props) {
  const { changeErrorMessages, resetMessages } = useContext(MainContext);

  const { executeAsync: startNewSolution, isPending: isScrambling } = useAction(startNewCollectiveCubingSolutionSF);
  const { executeAsync: makeMove, isPending: isMakingMove } = useAction(makeCollectiveCubingMoveSF);
  // null means a solution has never been started
  const [collectiveSolution, setCollectiveSolution] = useState<CollectiveSolutionResponse | null>(
    initCollectiveSolution,
  );
  const [selectedMove, setSelectedMove] = useState<NxNMove | null>(null);
  const twistyPlayerContainerRef = useRef<HTMLDivElement | null>(null);
  const twistyPlayerRef = useRef<TwistyPlayer | null>(null);

  const isSolved = !collectiveSolution || collectiveSolution.state === "solved";
  const numberOfSolves = collectiveSolution
    ? collectiveSolution.attemptNumber - (collectiveSolution.state === "ongoing" ? 1 : 0)
    : 0;

  useEffect(() => {
    if (!getIsWebglSupported()) {
      changeErrorMessages(["Please enable WebGL to render the cube"]);
    } else if (!twistyPlayerRef.current && twistyPlayerContainerRef.current) {
      updatePuzzleState(collectiveSolution);
    }
  }, [changeErrorMessages]);

  const updatePuzzleState = (newSolution: CollectiveSolutionResponse | null, reset = false) => {
    setCollectiveSolution(newSolution);

    const alg =
      newSolution?.state === "ongoing" ? new Alg(newSolution.scramble).concat(newSolution.solution) : new Alg();

    if (reset) {
      twistyPlayerContainerRef.current!.removeChild(twistyPlayerRef.current!);
      twistyPlayerRef.current = null;
    }

    if (!twistyPlayerRef.current) {
      twistyPlayerRef.current = new TwistyPlayer({
        puzzle: "2x2x2",
        alg,
        hintFacelets: "none",
        controlPanel: "none",
        background: "none",
        visualization: "PG3D", // makes the puzzle black
      });

      twistyPlayerContainerRef.current!.appendChild(twistyPlayerRef.current);
    } else {
      twistyPlayerRef.current.alg = alg;
    }
  };

  const scramblePuzzle = async () => {
    const res = await startNewSolution();

    if (res.serverError || res.validationErrors) {
      if (res.serverError?.data) updatePuzzleState(res.serverError.data);
      changeErrorMessages([getActionError(res)]);
    } else {
      updatePuzzleState(res.data!);
      resetMessages();
    }
  };

  const submitMove = async () => {
    if (collectiveSolution && selectedMove) {
      const res = await makeMove({ move: selectedMove, lastSeenSolution: collectiveSolution.solution });

      if (res.serverError || res.validationErrors) {
        if (res.serverError?.data) updatePuzzleState(res.serverError.data.isSolved ? null : res.serverError.data);
        changeErrorMessages([getActionError(res)]);
      } else {
        twistyPlayerRef.current!.experimentalAddMove(selectedMove);
        resetMessages();
      }

      setSelectedMove(null);
    }
  };

  const onConfirmKeybind = (e: any) => {
    if (e.key === "Enter" && e.ctrlKey) {
      submitMove();
    }
  };

  // const coloredTextStyles = "px-1 bg-dark rounded";

  return (
    <>
      <p>
        Let's solve Rubik's Cubes together! Simply log in and make a turn.{" "}
        {/* <b className={coloredTextStyles} style={{ color: "#ff0" }}>
          U
        </b>{" "}
        is the{" "}
        <b className={coloredTextStyles} style={{ color: "#ff0" }}>
          yellow
        </b>{" "}
        face and{" "}
        <b className={coloredTextStyles} style={{ color: "#0f0" }}>
          F
        </b>{" "}
        is{" "}
        <b className={coloredTextStyles} style={{ color: "#0f0" }}>
          green
        </b>. */}
        You may not make two turns in a row. Submit with Ctrl + Enter after selecting a move as a shortcut.
      </p>

      <ToastMessages />

      {collectiveSolution !== undefined && (
        <div className="row gap-3">
          <div className="col-md-4">
            <div className="d-flex flex-column align-items-center">
              <div ref={twistyPlayerContainerRef} style={{ maxWidth: "100%" }} />

              {isSolved && (
                <Button
                  id="scramble_button"
                  onClick={scramblePuzzle}
                  isLoading={isScrambling}
                  className="btn-success mt-2 mb-4 w-100"
                >
                  Scramble
                </Button>
              )}
              <p>
                All-time number of solves: <b>{numberOfSolves}</b>
              </p>
            </div>
          </div>
          <div className="col-md-8" style={{ maxWidth: "500px" }}>
            {!isSolved && (
              <>
                <div
                  className="mt-1 mt-md-4 gap-1 gap-md-3"
                  style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)" }}
                >
                  {nxnMoves.map((move) => (
                    <div key={move} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSelectedMove(move)}
                        disabled={isMakingMove}
                        onKeyDown={selectedMove === move ? onConfirmKeybind : undefined}
                        className={`btn btn-primary ${selectedMove === move ? "active" : ""} w-100`}
                      >
                        {move}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="my-3 my-md-4">
                  <Button
                    id="confirm_button"
                    onClick={submitMove}
                    disabled={!selectedMove}
                    isLoading={isMakingMove}
                    className="btn-success w-100"
                  >
                    Confirm
                  </Button>
                </div>
                <div className="d-flex justify-content-between my-3 gap-3 align-items-center">
                  <p className="m-0">
                    Moves used:{" "}
                    <b>
                      {collectiveSolution?.solution ? (collectiveSolution.solution.match(/ /g)?.length ?? 0) + 1 : 0}
                    </b>
                  </p>
                  <Button onClick={() => updatePuzzleState(collectiveSolution, true)} className="btn-xs btn-secondary">
                    Reset Orientation
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default CollectiveCubing;
