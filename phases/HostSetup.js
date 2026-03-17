(function(){
window.BG = window.BG || {};
BG.phases = BG.phases || {};
const { h, useState, useRef } = BG.core;
const { Btn, Card, Inp } = BG.ui;
const { genCode } = BG.consts;
const { saveRoom } = BG.fb;

function HostSetup({onStart}) {
  const [name,setName]=useState("");

  // NEW: duration inputs
  const [days,setDays]=useState(0);
  const [hours,setHours]=useState(0);
  const [minutes,setMinutes]=useState(20);

  // existing wager limit
  const [maxTotal,setMaxTotal]=useState("14");
  const [noLimit,setNoLimit]=useState(false);

  const code=useRef(genCode()).current;

  const durationMs =
    (Number(days)||0)*24*60*60*1000 +
    (Number(hours)||0)*60*60*1000 +
    (Number(minutes)||0)*60*1000;

  const start=async()=>{
    if(!name.trim()) return;

    // minimum 5 minutes
    const safeDurationMs = Math.max(5*60*1000, durationMs || 0);

    const room={
      code,
      phase:"lobby",
      hostName:name.trim(),

      // NEW preferred field
      durationMs: safeDurationMs,

      // backward compat (so other code still works)
      timerMinutes: Math.round(safeDurationMs/60000),

      maxWagerTotal:(noLimit?null:(parseInt(maxTotal||"14",10)||14)),
      players:[{name:name.trim(),group:null,id:genCode()}],
      bets:[],votes:{},wagers:{},oddsMap:{},verifiedBets:[],expiredBets:[],
      drinkTotals:{},giveTotals:{},timerEnd:null,guessLog:[],activeBets:[],
      lastGuessResult:null,lastVerifiedBet:null,shortWins:[]
    };

    await saveRoom(code,room);
    onStart(room,name.trim());
  };

  return h("div",{className:"col"},
    h("h2",{className:"text-2xl font-bold"},"Host Setup"),

    h(Card,{},
      h("span",{className:"label"},"Your name"),
      h(Inp,{value:name,onChange:setName,placeholder:"Enter your name"})
    ),

    h(Card,{},
      h("span",{className:"label"},"Game duration"),
      h("div",{className:"flex items-center gap2",style:{flexWrap:"wrap"}},
        h(Inp,{
          value:String(days),
          onChange:v=>setDays(Math.max(0, parseInt(v||"0",10)||0)),
          placeholder:"0",
          style:{maxWidth:"4.5rem"}
        }),
        h("span",{className:"muted text-sm"},"days"),

        h(Inp,{
          value:String(hours),
          onChange:v=>setHours(Math.max(0, Math.min(23, parseInt(v||"0",10)||0))),
          placeholder:"0",
          style:{maxWidth:"4.5rem"}
        }),
        h("span",{className:"muted text-sm"},"hours"),

        h(Inp,{
          value:String(minutes),
          onChange:v=>setMinutes(Math.max(0, Math.min(59, parseInt(v||"0",10)||0))),
          placeholder:"20",
          style:{maxWidth:"4.5rem"}
        }),
        h("span",{className:"muted text-sm"},"min")
      )
    ),

    h(Card,{},
      h("span",{className:"label"},"Max total wager per player (sum of abs wagers)"),
      h("div",{className:"flex items-center gap3"},
        h(Btn,{onClick:()=>setNoLimit(v=>!v),color:noLimit?"green":"gray",sm:true},noLimit?"No limit":"Set limit"),
        !noLimit && h(Inp,{value:maxTotal,onChange:setMaxTotal,placeholder:"14",style:{maxWidth:"6rem"}}),
        !noLimit && h("span",{className:"muted text-sm"},"sips")
      ),
      h("p",{className:"muted text-xs mt2"},"Counts both longs and shorts using absolute value. Per-bet max is still 14.")
    ),

    h(Btn,{onClick:start,color:"green",full:true},"Create Room")
  );
}

BG.phases.HostSetup = HostSetup;
})();
