'use client';

import { useId, useState, type CSSProperties } from 'react';
import { JOURNEY_GAMES, type JourneyChapterId } from './city-journey-config';
import c from './city-chapter-detail.module.css';

// Archived match and quiz result: official sources and verification dates in
// docs/CITY-CHAPTER-DETAILS.md. The forecast is deliberately illustrative.
const MATCH_SOURCE = 'https://www.iplt20.com/matches/bd7c710f-ce79-40fc-93d9-fbf4bf83a794/More/scorecard';
const NBA_SOURCE = 'https://www.nba.com/news/2026-nba-finals-schedule';
const contenders = [
  { name:'Lamine Yamal', label:'Yamal', color:'cyan', values:[24,26,23,30,29,35,34,39,37,44] },
  { name:'Kylian Mbappé', label:'Mbappé', color:'gold', values:[38,37,41,36,39,33,36,31,35,34] },
  { name:'Erling Haaland', label:'Haaland', color:'violet', values:[38,37,36,34,32,32,30,30,28,22] },
] as const;
const answers = ['Boston Celtics','New York Knicks','Oklahoma City Thunder','San Antonio Spurs'];
const point = (value:number,index:number) => `${14+index*54},${96-value*1.6}`;

function MatchDetail() {
  return <section className={c.panel + ' ' + c.match} data-chapter-detail="follow" aria-label="RCB versus CSK match stats">
    <div className={c.meta}><span>IPL / 03 MAY 2025</span><b>RESULT</b></div>
    <div className={c.scoreboard}>
      <div className={c.team}><span className={c.badge} data-team="rcb">RCB</span><span><b>Royal Challengers</b><small>Bengaluru</small></span></div>
      <div className={c.score}><strong>213<span>/5</span></strong><small>20.0 OV · RR 10.65</small></div>
      <div className={c.team}><span className={c.badge} data-team="csk">CSK</span><span><b>Chennai Super Kings</b><small>Chennai</small></span></div>
      <div className={c.score}><strong>211<span>/5</span></strong><small>20.0 OV · RR 10.55</small></div>
    </div>
    <div className={c.matchFooter}><p><i aria-hidden="true" />RCB won by <b>2 runs</b></p><a href={MATCH_SOURCE} target="_blank" rel="noreferrer" aria-label="Read the official RCB versus CSK scorecard">Scorecard <span aria-hidden="true">↗</span></a></div>
  </section>;
}

function PredictionDetail() {
  const [selected,setSelected] = useState(0);
  const gradient=useId().replace(/:/g,'');
  const current=contenders[selected];
  return <section className={c.panel + ' ' + c.prediction} data-chapter-detail="predict" aria-labelledby="city-prediction-question">
    <div className={c.meta}><span>BALLON D’OR / 2027</span><b>ILLUSTRATIVE FORECAST</b></div>
    <h3 id="city-prediction-question">Who will be the Ballon d’Or winner?</h3>
    <svg className={c.chart} viewBox="0 0 520 112" role="img" aria-label={`Illustrative forecast, not live probabilities. Lamine Yamal 44 percent, Kylian Mbappé 34 percent, Erling Haaland 22 percent. Highlighting ${current.name}.`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`var(--ds-color-accent-${current.color})`} stopOpacity=".22" /><stop offset="1" stopColor={`var(--ds-color-accent-${current.color})`} stopOpacity="0" /></linearGradient></defs>
      <g className={c.chartGrid}><path d="M14 16H500M14 56H500M14 96H500M122 10V96M230 10V96M338 10V96M446 10V96" /></g>
      <path d={`M${current.values.map(point).join(' L')} L500 96 L14 96 Z`} fill={`url(#${gradient})`} />
      {contenders.map((candidate,index)=><polyline key={candidate.name} points={candidate.values.map(point).join(' ')} pathLength="1" className={c.chartLine} data-highlighted={selected===index} style={{'--series-color':`var(--ds-color-accent-${candidate.color})`} as CSSProperties} />)}
      <circle cx="500" cy={96-current.values[9]*1.6} r="4" fill={`var(--ds-color-accent-${current.color})`} stroke="var(--ds-color-background-muted)" strokeWidth="2" />
      <g className={c.chartLabels}><text x="14" y="109">EARLIER</text><text x="500" y="109" textAnchor="end">NOW</text></g>
    </svg>
    <div className={c.contenders} role="group" aria-label="Highlight a Ballon d’Or prediction">
      {contenders.map((candidate,index)=><button type="button" key={candidate.name} aria-pressed={selected===index} aria-label={`${candidate.name}, ${candidate.values[9]} percent illustrative forecast`} onClick={()=>setSelected(index)} style={{'--series-color':`var(--ds-color-accent-${candidate.color})`} as CSSProperties}><span><i aria-hidden="true" />{candidate.label}</span><b>{candidate.values[9]}<small>%</small></b></button>)}
    </div>
  </section>;
}

function QuizDetail() {
  const [answer,setAnswer]=useState<number|null>(null);
  const correct=answer===1;
  return <section className={c.panel + ' ' + c.quiz} data-chapter-detail="knowledge" aria-labelledby="city-quiz-question">
    <div className={c.meta}><span>THE KNOWLEDGE CHECK</span><b>NBA / 2026</b></div>
    <h3 id="city-quiz-question">Who were the NBA champions of 2026?</h3>
    <div className={c.answers} role="group" aria-labelledby="city-quiz-question">
      {answers.map((team,index)=><button type="button" key={team} aria-pressed={answer===index} data-result={answer===index ? correct?'correct':'incorrect':undefined} onClick={()=>setAnswer(index)}><span className={c.answerNumber} aria-hidden="true">0{index+1}</span><span>{team}</span><span className={c.answerCheck} aria-hidden="true">{answer===index?(correct?'✓':'×'):''}</span></button>)}
    </div>
    <p className={c.quizFeedback} role="status" aria-live="polite">{answer===null?'Pick your champion.':correct?<>Correct. New York won the series 4–1. <a href={NBA_SOURCE} target="_blank" rel="noreferrer" aria-label="Read the 2026 NBA Finals result">↗</a></>:'Not quite. Try another team.'}</p>
  </section>;
}

function GamesDetail() {
  return <section className={c.panel + ' ' + c.games} data-chapter-detail="games" aria-label="Discover StatOz games">
    <div className={c.meta}><span>YOUR NEXT OBSESSION</span><b>STATOZ GAMES</b></div>
    <ul className={c.gameStrip} aria-label="Games to play">
      {JOURNEY_GAMES.slice(0,6).map(game=><li key={game.slug}><a href={'https://games.statoz.in/play/'+game.slug} aria-label={'Play '+game.name}><span className={c.gameArt}><img src={game.image} alt="" width="180" height="240" loading="lazy" /></span><span className={c.gameCaption}><small>{game.sport}</small><b>{game.name}</b><i aria-hidden="true">↗</i></span></a></li>)}
    </ul>
  </section>;
}

export function CityChapterDetail({id}:{id:JourneyChapterId}) {
  if(id==='follow') return <MatchDetail />;
  if(id==='predict') return <PredictionDetail />;
  if(id==='knowledge') return <QuizDetail />;
  if(id==='games') return <GamesDetail />;
  return null;
}
