(function(){
window.BG = window.BG || {};
BG.phases = BG.phases || {};
const { h, useState, useEffect, useRef, useCallback } = BG.core;
const { Btn, Card, Inp, Sel } = BG.ui;
const { VerifyPopup, GuessPopup, RulesPopup } = BG.popups;
const { SIPS, LIKELIHOOD_OPTIONS, ODDS_MAP, genCode, sipsToDrinks, computeOdds } = BG.consts;
const { saveRoom, subscribeRoom, loadRoom } = BG.fb;

function LivePhase({room,myName,isHost,onRoomUpdate}) {
  const me=room.players.find(p=>p.name===myName);
  const myGroup=me?.group;
  const [timeLeft,setTimeLeft]=useState(Math.max(0,(room.timerEnd||0)-Date.now()));
  const [guessText,setGuessText]=useState(""), [showGuess,setShowGuess]=useState(false);
  const [verifyPopup,setVerifyPopup]=useState(null);
  const [guessPopup,setGuessPopup]=useState(null);
  const endedRef=useRef(false), lastVerifiedRef=useRef(null);
  
  // NEW: missed bet-hit banner (per device)
  const roomKey = `betgame:lastSeenSeq:${room.code}`;
  const [missedHitEvents, setMissedHitEvents] = useState([]);
  const [showMissed, setShowMissed] = useState(false);
  
  useEffect(() => {
    const currentSeq = room.eventSeq || 0;
    const lastSeen = Number(localStorage.getItem(roomKey) || 0);
    const log = room.eventLog || [];
  
    if (currentSeq > lastSeen) {
      const missed = log.filter(e => (e.seq || 0) > lastSeen && e.type === "verify" && e.betId);
      setMissedHitEvents(missed);
    } else {
      setMissedHitEvents([]);
    }
  }, [room.eventSeq, room.eventLog]);
  
  const dismissMissed = () => {
    const currentSeq = room.eventSeq || 0;
    localStorage.setItem(roomKey, String(currentSeq));
    setMissedHitEvents([]);
    setShowMissed(false);
  };
  useEffect(()=>{const iv=setInterval(()=>setTimeLeft(Math.max(0,(room.timerEnd||0)-Date.now())),1000);return()=>clearInterval(iv);},[room.timerEnd]);

  useEffect(()=>{
    const lv=room.lastVerifiedBet; if(!lv) return;
    if(lastVerifiedRef.current===lv.ts) return;
    lastVerifiedRef.current=lv.ts; setVerifyPopup(lv);
  },[room.lastVerifiedBet]);

  const lastGuessRef=useRef(null);
  useEffect(()=>{
    const lg=room.lastGuessResult; if(!lg) return;
    if(lastGuessRef.current===lg.ts) return;
    lastGuessRef.current=lg.ts; setGuessPopup(lg);
  },[room.lastGuessResult]);

  const activeBetIds=room.activeBets||[];
  const myGroupBets=(room.bets||[]).filter(b=>b.group===myGroup&&activeBetIds.includes(b.id));
  const fmt=ms=>{const s=Math.floor(ms/1000),m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,"0")}`;};

  const resolveBetVerified=(bet,r)=>{
    const drinkTotals={...(r.drinkTotals||{})};
    const giveTotals={...(r.giveTotals||{})};
    const odds=(r.oddsMap||{})[bet.id]||1;
    const outcomes={}; // player -> {give, drink}

    r.players.forEach(p=>{
      const w=(r.wagers||{})[p.name]?.[bet.id];
      if(!w) return;

      if(w>0){
        // Long hit -> hand out wager * odds (popup only; not counted in end totals)
        const g=Math.round(w*odds);
        outcomes[p.name]={give:g,drink:0};
      } else {
        // Short hit -> drink |w| now (counts toward end totals)
        const d=Math.abs(w);
        outcomes[p.name]={give:0,drink:d};
      }
    });

    return {drinkTotals,giveTotals,outcomes};
  };

  const resolveBetExpired=(bet,r)=>{
    const drinkTotals={...(r.drinkTotals||{})};
    const giveTotals={...(r.giveTotals||{})};
    const outcomes={};

    r.players.forEach(p=>{
      const w=(r.wagers||{})[p.name]?.[bet.id];
      if(!w) return;

      if(w<0){
        // Short was RIGHT -> hand out |w| (no odds)
        const g=Math.abs(w);
        giveTotals[p.name]=(giveTotals[p.name]||0)+g;
        outcomes[p.name]={give:g,drink:0};
      } else {
        // Long was WRONG -> drink w
        const d=Math.abs(w);
        drinkTotals[p.name]=(drinkTotals[p.name]||0)+d;
        outcomes[p.name]={give:0,drink:d};
      }
    });

    return {drinkTotals,giveTotals,outcomes};
  };

  const endGame=useCallback(async()=>{
    if(endedRef.current) return; endedRef.current=true;
    const verifiedSet = new Set(room.verifiedBets||[]);
    const still=(room.bets||[]).filter(b=>(room.activeBets||[]).includes(b.id) && !verifiedSet.has(b.id));
    let drinkTotals={...(room.drinkTotals||{})};
    let giveTotals={...(room.giveTotals||{})};
    // Any still-active bets at timer end are treated as "expired" (did NOT happen)
    still.forEach(b=>{
      const res=resolveBetExpired(b,{...room,drinkTotals,giveTotals});
      drinkTotals=res.drinkTotals;
      giveTotals=res.giveTotals;
    });
    const u={...room,phase:"end",activeBets:[],
      expiredBets:[...(room.expiredBets||[]),...still.map(b=>b.id)],
      drinkTotals,giveTotals,
      lastVerifiedBet:null};
    await saveRoom(room.code,u); onRoomUpdate(u);
  },[room]);

  useEffect(()=>{if(timeLeft===0&&room.phase==="live"&&isHost) endGame();},[timeLeft]);

const verifyBet=async bet=>{
  const res=resolveBetVerified(bet,room);

  // NEW: event counter/log so phones can show "missed bet hits"
  const nextSeq = (room.eventSeq || 0) + 1;
  const nextLog = [
    ...((room.eventLog || []).slice(-30)),
    { seq: nextSeq, ts: Date.now(), type: "verify", betId: bet.id, by: myName }
  ];

  const u={...room,
    activeBets:activeBetIds.filter(id=>id!==bet.id),
    verifiedBets:[...(room.verifiedBets||[]),bet.id],
    drinkTotals:res.drinkTotals,
    giveTotals:res.giveTotals,
    lastVerifiedBet:{
      id:bet.id,target:bet.target,text:bet.text,author:bet.author,
      outcomes:res.outcomes,
      ts:Date.now()
    },

    // NEW:
    eventSeq: nextSeq,
    eventLog: nextLog
  };

  await saveRoom(room.code,u); onRoomUpdate(u);
};
  const submitGuess=async()=>{
    if(!guessText.trim()) return;
    const otherBets=(room.bets||[]).filter(b=>b.group!==myGroup && activeBetIds.includes(b.id));
    const q = guessText.toLowerCase().trim();
    const match=otherBets.find(b=>{
      const t=(b.text||"").toLowerCase();
      return t.includes(q) || q.includes(t.substring(0,12));
    });

    if(match){
      // Everyone who wagered on THAT bet (match.group) drinks abs(their wager), regardless long/short.
      const penalties = {};
      room.players
        .filter(p => p.group === match.group)
        .forEach(p => {
          const w = (room.wagers || {})[p.name]?.[match.id] || 0;
          penalties[p.name] = Math.abs(w);
        });

      const u={
        ...room,
        activeBets: activeBetIds.filter(id=>id!==match.id),
        guessedBets: [ ...((room.guessedBets)||[]), match.id ],
        lastGuessResult:{
          ts: Date.now(),
          guesser: myName,
          correct: true,
          bet: { id: match.id, target: match.target, text: match.text, author: match.author },
          penalties
        }
      };
      await saveRoom(room.code,u); onRoomUpdate(u);
    } else {
      const highest=Math.max(1,...otherBets.map(b=>Math.abs((room.wagers||{})[b.author]?.[b.id]||1)));
      const u={
        ...room,
        lastGuessResult:{
          ts: Date.now(),
          guesser: myName,
          correct: false,
          penalty: highest
        }
      };
      await saveRoom(room.code,u); onRoomUpdate(u);
    }

    setGuessText(""); setShowGuess(false);
  };

  const tClass=timeLeft<60000?"timer timer-red":timeLeft<180000?"timer timer-yellow":"timer timer-green";
  const otherActive=(room.bets||[]).filter(b=>b.group!==myGroup&&activeBetIds.includes(b.id));
  const highest=Math.max(1,...otherActive.map(b=>Math.abs((room.wagers||{})[b.author]?.[b.id]||1)));

  // NEW: summary for banner
  const missedHits = missedHitEvents.length;

  const handoutFromMissedHits = missedHitEvents.reduce((sum, e) => {
    const betId = e.betId;
    const w = Number(((room.wagers || {})[myName] || {})[betId] || 0);
    if (w <= 0) return sum; // only longs give handouts when bet hits
    const odds = (room.oddsMap || {})[betId] || 1;
    return sum + Math.round(w * odds);
  }, 0);

  return h("div",{className:"col",style:{paddingTop:"1rem"}},
    verifyPopup&&h(VerifyPopup,{
      bet:verifyPopup,
      room,
      myName,
      onClose:()=>setVerifyPopup(null)
    }),
    guessPopup&&h(GuessPopup,{result:guessPopup,myName,onClose:()=>setGuessPopup(null)}),
  showMissed && h("div",{className:"overlay"},
  h(Card,{className:"overlay-card card-yellow"},
    h("div",{className:"text-5xl mb3"},"🔔"),
    h("p",{className:"font-black text-xl mb2 c-yellow"},"Bet that have hit"),
    h("div",{style:{maxHeight:"50vh", overflowY:"auto", textAlign:"left"}},
      ...(missedHitEvents.slice().reverse().map(ev => {
        const bet = (room.bets || []).find(b => b.id === ev.betId);
        if (!bet) return h("p",{className:"muted text-sm"},`Bet ${ev.betId} hit`);

        const w = Number(((room.wagers || {})[myName] || {})[ev.betId] || 0);
        const odds = (room.oddsMap || {})[ev.betId] || 1;

        let action = "No wager";
        if (w > 0) action = `Hand out ${Math.round(w * odds)} sips`;
        else if (w < 0) action = `Drink ${Math.abs(w)} sips`;

        return h("div",{key:ev.seq, className:"bet-row"},
          h("div",{style:{flex:1}},
            h("div",{className:"row-between"},
              h("span",{className:"c-indigo font-semibold"}, bet.target),
              h("span",{className:"muted text-xs"}, action)
            ),
            h("div",{className:"text-sm"}, bet.text)
          )
        );
      }))
    ),
    h("div",{className:"mt3"}),
    h(Btn,{onClick:dismissMissed,color:"yellow",full:true},"Got it")
  )
),
    h("div",{className:"row-between"},
      h("span",{className:tClass},fmt(timeLeft)),
      h("span",{className:`badge ${myGroup==="A"?"badge-a":"badge-b"}`},myGroup==="A"?"🔵 Group A":"🔴 Group B")
    ),
           missedHits > 0 && h(Card,{className:"card-yellow"},
  h("div",{className:"row-between"},
    h("div",{},
      h("p",{className:"font-black c-yellow",style:{margin:"0 0 0.25rem 0"}},
        `${missedHits} bet${missedHits!==1?"s":""} hit · You can hand out ${handoutFromMissedHits} sip${handoutFromMissedHits!==1?"s":""}`
      ),
      h("p",{className:"muted text-xs",style:{margin:0}},
        "Tap “See” to view which bets hit while you were away."
      )
    ),
    h("div",{className:"row",style:{gap:"0.5rem"}},
      h(Btn,{onClick:()=>setShowMissed(true),color:"gray",sm:true},"See"),
      h(Btn,{onClick:dismissMissed,color:"yellow",sm:true},"Dismiss")
    )
  )
),
    h("h3",{className:"font-bold",style:{color:"rgba(255,255,255,0.85)",margin:0}},"Your Group's Active Bets"),
    myGroupBets.length===0&&h("p",{className:"muted italic"},"No active bets."),
    ...myGroupBets.map(b=>{
      const odds=(room.oddsMap||{})[b.id]||1;
      const longs=room.players.filter(p=>((room.wagers||{})[p.name]?.[b.id]||0)>0);
      const shorts=room.players.filter(p=>((room.wagers||{})[p.name]?.[b.id]||0)<0);
      return h(Card,{key:b.id},
        h("div",{className:"row-between mb1"},
          h("p",{className:"c-indigo font-semibold text-sm",style:{margin:0}},b.target),
          h("span",{className:"c-yellow text-xs font-bold"},`${odds}x odds`)
        ),
        h("p",{className:"mb2 text-sm",style:{margin:"0 0 0.5rem"}},b.text),
        longs.length>0&&h("p",{className:"c-green text-xs mb1",style:{margin:"0 0 0.25rem"}},`📈 Long: ${longs.map(p=>`${p.name} (${(room.wagers||{})[p.name][b.id]})`).join(", ")}`),
        shorts.length>0&&h("p",{className:"c-orange text-xs mb2",style:{margin:"0 0 0.5rem"}},`📉 Short: ${shorts.map(p=>`${p.name} (${(room.wagers||{})[p.name][b.id]})`).join(", ")}`),
        h(Btn,{onClick:()=>verifyBet(b),color:"green",sm:true},"✓ Verify — It Happened!")
      );
    }),
    h(Btn,{onClick:()=>setShowGuess(!showGuess),color:"yellow",full:true},"🎯 Guess Their Bet"),
    showGuess&&h(Card,{},
      h("p",{className:"muted text-sm mb2"},"Type roughly what you think their bet says:"),
      h(Inp,{value:guessText,onChange:setGuessText,placeholder:"They bet that..."}),
      h("div",{className:"flex gap2 mt3"},
        h(Btn,{onClick:submitGuess,color:"indigo",sm:true},"Submit Guess"),
        h(Btn,{onClick:()=>setShowGuess(false),color:"gray",sm:true},"Cancel")
      ),
      h("p",{className:"c-red text-xs mt2"},`Wrong guess penalty: ${highest} sips`)
    ),
    isHost&&h(Btn,{onClick:endGame,color:"rose",sm:true},"End Game Early")
  );
}

BG.phases.LivePhase = LivePhase;

})();
