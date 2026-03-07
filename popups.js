(function(){
/* Popups */
window.BG = window.BG || {};
BG.popups = BG.popups || {};
const { h } = BG.core;
const { Card, Btn } = BG.ui;

function VerifyPopup({bet,room,myName,onClose}) {
  const outcomes = bet.outcomes || {};
  const mine = outcomes[myName] || {give:0, drink:0};

  const headline = "Bet hit!";
  const didLine = `${bet.target} did:`;
  const actionLine = bet.text;

  return h("div",{className:"overlay"},
    h(Card,{className:"overlay-card card-green"},
      h("div",{className:"text-5xl mb3"},"✅"),
      h("p",{className:"font-black text-xl mb2 c-green"},headline),

      h("p",{className:"c-indigo font-semibold mb1"},didLine),
      h("p",{className:"mb3"},actionLine),

      mine.give>0 && h("p",{className:"font-black c-yellow mb3"},`You can now hand out ${mine.give} sip${mine.give!==1?"s":""}.`),
      mine.drink>0 && h("p",{className:"font-black c-red mb3"},`You drink ${mine.drink} sip${mine.drink!==1?"s":""}.`),
      (mine.give===0 && mine.drink===0) && h("p",{className:"muted mb3"},"No action for you on this one."),

      h(Btn,{onClick:onClose,color:"green",full:true},"Got it!")
    )
  );
}

function GuessPopup({result, myName, onClose}) {
  const bet = result.bet || {};
  const penalties = result.penalties || {};
  const mine = penalties[myName] || 0;

  const headline = result.correct ? "Bet guessed!" : "Wrong guess!";
  const sub = result.correct ? `${result.guesser} guessed this bet:` : `${result.guesser} guessed wrong.`;

  return h("div",{className:"overlay"},
    h(Card,{className:`overlay-card ${result.correct ? "card-green" : "card-red"}`},
      h("div",{className:"text-5xl mb3"}, result.correct ? "🎯" : "❌"),
      h("p",{className:`font-black text-xl mb2 ${result.correct ? "c-green" : "c-red"}`}, headline),
      h("p",{className:"muted mb2"}, sub),

      result.correct && h("div",{style:{textAlign:"left"}, className:"mb3"},
        h("p",{className:"c-indigo font-semibold mb1"},`${bet.target || ""}`),
        h("p",{className:"mb1"}, bet.text || ""),
        bet.author && h("p",{className:"muted text-xs"},`(bet by ${bet.author})`)
      ),

      result.correct && mine > 0 && h("p",{className:"font-black c-red mb3"},`You drink ${mine} sip${mine!==1?"s":""}.`),
      result.correct && mine === 0 && h("p",{className:"muted mb3"},"No wager for you on this bet."),

      !result.correct && h("p",{className:"font-black c-red mb3"},`Penalty: ${result.penalty} sip${result.penalty!==1?"s":""}.`),

      h(Btn,{onClick:onClose, color: result.correct ? "green" : "red", full:true},"Got it!")
    )
  );
}

function RulesPopup({onClose}) {
  return h("div",{className:"overlay"},
    h(Card,{className:"overlay-card card-yellow"},
      h("div",{className:"text-5xl mb3"},"📜"),
      h("p",{className:"font-black text-xl mb2 c-yellow"},"Rules"),
      h("div",{style:{textAlign:"left"}},
        h("p",{className:"muted text-sm mb2"},"1) Make bets (each player writes bets about the other group)."),
        h("p",{className:"muted text-sm mb2"},"2) Vote on the likelihood of the bets coming true."),
        h("p",{className:"muted text-sm mb2"},"3) Wager on ALL bets from your group (positive = it happens, negative = it won’t)."),
        h("p",{className:"muted text-sm mb2"},"4) During the game, verify a bet when it happens:"),
        h("p",{className:"muted text-sm mb2",style:{marginLeft:"0.75rem"}},"• Long hits: you can hand out (wager × odds) sips (shown in popup)."),
        h("p",{className:"muted text-sm mb2",style:{marginLeft:"0.75rem"}},"• Short hits: you drink your shorted sips (shown in popup)."),
        h("p",{className:"muted text-sm mb2"},"5) End of game: any unverified bets are treated as ‘didn’t happen’."),
        h("p",{className:"muted text-sm mb2",style:{marginLeft:"0.75rem"}},"• Long didn’t hit: you drink your wagered sips (counts in final totals)."),
        h("p",{className:"muted text-sm mb2",style:{marginLeft:"0.75rem"}},"• Short didn’t hit: you can hand out your wagered sips (counts in final totals)."),
      ),
      h("div",{className:"mt4"}),
      h(Btn,{onClick:onClose,color:"yellow",full:true},"Got it!")
    )
  );
}

BG.popups.VerifyPopup=VerifyPopup;
BG.popups.GuessPopup=GuessPopup;
BG.popups.RulesPopup=RulesPopup;

})();
