(function(){
/* Main app entry */
window.BG = window.BG || {};
const { h, useState, useEffect, useRef, useCallback } = BG.core;
const { Btn, Card, Inp, Sel } = BG.ui;   // <-- this line fixes it
const { Landing, HostSetup, Lobby, BettingPhase, VotingPhase, WageringPhase, LivePhase, EndPhase } = BG.phases;
const { subscribeRoom, loadRoom, saveRoom } = BG.fb;

function App() {
  const [screen,setScreen]=useState("landing");
  const [room,setRoom]=useState(null), [myName,setMyName]=useState("");
  const [joinCode,setJoinCode]=useState(""), [joinName,setJoinName]=useState(""), [joinError,setJoinError]=useState("");
  const unsubRef=useRef(null);

  const subscribe=useCallback(code=>{
    if(unsubRef.current) unsubRef.current();
    unsubRef.current=subscribeRoom(code,setRoom);
  },[]);
  useEffect(()=>()=>{if(unsubRef.current) unsubRef.current();},[]);

  const handleHost=(r,name)=>{setRoom(r);setMyName(name);setScreen("game");subscribe(r.code);};
  const handleJoinCode=async code=>{
    setJoinError(""); if(!code) return;
    const r=await loadRoom(code);
    if(!r){setJoinError("Room not found.");return;}
    setJoinCode(code);setRoom(r);setScreen("joining");
  };
  const confirmJoin=async()=>{
    if(!joinName.trim()) return;
    const r=await loadRoom(joinCode); if(!r){setJoinError("Room expired.");return;}
    const already=r.players.find(p=>p.name===joinName.trim());
    const updated=already?r:{...r,players:[...r.players,{name:joinName.trim(),group:null,id:genCode()}]};
    if(!already) await saveRoom(r.code,updated);
    setMyName(joinName.trim());setRoom(updated);setScreen("game");subscribe(updated.code);
  };

  if(screen==="landing") return h("div",{className:"page"},h(Landing,{onHost:()=>setScreen("hostSetup"),onJoin:handleJoinCode}));
  if(screen==="hostSetup") return h("div",{className:"page"},h(HostSetup,{onStart:handleHost}));
  if(screen==="joining") return h("div",{className:"page"},
    h("div",{className:"col-center"},
      h("h2",{className:"text-2xl font-bold"},`Joining Room ${joinCode}`),
      h(Inp,{value:joinName,onChange:setJoinName,placeholder:"Your name",style:{maxWidth:"20rem"}}),
      joinError&&h("p",{style:{color:"#f87171",fontSize:"0.875rem"}},joinError),
      h(Btn,{onClick:confirmJoin,color:"green"},"Join Game")
    )
  );
  if(!room) return null;

  const isHost=myName===room.hostName;
  const phases={
    lobby:h(Lobby,{room,myName,isHost,onRoomUpdate:setRoom}),
    betting:h(BettingPhase,{room,myName,isHost,onRoomUpdate:setRoom}),
    voting:h(VotingPhase,{room,myName,isHost,onRoomUpdate:setRoom}),
    wagering:h(WageringPhase,{room,myName,isHost,onRoomUpdate:setRoom}),
    live:h(LivePhase,{room,myName,isHost,onRoomUpdate:setRoom}),
    end:h(EndPhase,{room,myName}),
  };
  return h("div",{className:"page"},phases[room.phase]||h("p",{className:"muted text-center",style:{marginTop:"5rem"}},"Unknown phase"));
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App,null));

})();
