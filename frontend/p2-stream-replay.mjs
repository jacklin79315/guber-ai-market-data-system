import {createReplaySession} from "./p2-replay.mjs";
import {iterateHistoricalWindows} from "./p2-history-stream.mjs";
// Process each history window immediately; account state persists across windows.
export async function replayHistoricalStream({proposals=[],costs,accountOptions={},...history}={}){
 const session=createReplaySession({proposals,costs,accountOptions});let windowsLoaded=0,historyCandleCount=0;
 for await(const batch of iterateHistoricalWindows(history)){
  session.append(batch);windowsLoaded++;historyCandleCount+=batch.length;
 }
 return {...session.finish(),windowsLoaded,historyCandleCount};
}
