import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, Character, LogEntry, DiceType, WarriorOption } from './types';
import { generateTurnOutcome, generateEnemyName, generateCharacterImage, generateWarriorOptions } from './services/geminiService';
import HealthBar from './components/HealthBar';
import Menu from './components/Menu';
import Dice from './components/Dice';
import { Timer, Trophy, RotateCcw, Volume2, Loader, User, ChevronRight } from 'lucide-react';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.START_MENU);
  
  // Stats
  const [player, setPlayer] = useState<Character>({
    name: "Hero",
    hp: 100,
    maxHp: 100,
    image: "", // Will generate
    level: 5,
    classType: "Warrior"
  });
  
  const [enemy, setEnemy] = useState<Character>({
    name: "Dragon",
    hp: 150,
    maxHp: 150,
    image: "",
    level: 8
  });

  // Battle State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [diceValue, setDiceValue] = useState(20);
  const [timer, setTimer] = useState(30);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [volume, setVolume] = useState(50);
  const [warriorOptions, setWarriorOptions] = useState<WarriorOption[]>([]);
  
  // Animation States
  const [playerAnim, setPlayerAnim] = useState('');
  const [enemyAnim, setEnemyAnim] = useState('');
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [flash, setFlash] = useState(false);

  // Refs for auto-scroll
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 1. Enter Selection Phase
  const initializeSelection = async () => {
      setIsGeneratingOptions(true);
      const options = await generateWarriorOptions();
      setWarriorOptions(options);
      setIsGeneratingOptions(false);
      setPhase(GamePhase.SELECT_CHARACTER);
  };

  // 2. Select Character & Start Game
  const handleSelectWarrior = async (option: WarriorOption) => {
    setIsLoadingImages(true);
    setLogs([]); // Clear logs
    
    // Set Player Basics
    setPlayer({
        name: option.name,
        classType: option.classType,
        hp: 100,
        maxHp: 100,
        image: "", 
        level: 5
    });

    // Parallel Generation: Player Image + Enemy Data + Enemy Image
    // This speeds up the "Loading..." phase
    const [heroImg, enemyData] = await Promise.all([
        generateCharacterImage(`Fantasy RPG sprite character, ${option.classType}, ${option.description}, back view`),
        generateEnemyName()
    ]);

    const enemyImg = await generateCharacterImage(`A fearsome ${enemyData.type} dragon boss, front view, menacing posture`);

    setPlayer(p => ({ ...p, image: heroImg || "https://picsum.photos/seed/hero/200/200" }));
    
    setEnemy({
        name: enemyData.name,
        hp: 150,
        maxHp: 150,
        image: enemyImg || `https://picsum.photos/seed/${enemyData.name}/300/300`,
        level: 8
    });

    setLogs([{ id: 'init', text: `A wild ${enemyData.name} appeared!`, type: 'info' }]);
    setTimer(30);
    setPhase(GamePhase.PLAYER_INPUT);
    setEnemyAnim('animate-spawn');
    setIsLoadingImages(false);
  };

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (phase === GamePhase.PLAYER_INPUT) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // Scroll to bottom of logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleTimeOut = () => {
    addLog("Time ran out! You hesitated.", 'info');
    processTurn("Hesitate", 1); // Automatic fail roll
  };

  const handleAction = (action: string) => {
    if (phase !== GamePhase.PLAYER_INPUT) return;
    setSelectedAction(action);
    setPhase(GamePhase.ROLLING_DICE);
    
    // Simulate Roll Delay
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      setDiceValue(roll);
      processTurn(action, roll);
    }, 1500); // 1.5s rolling animation
  };

  const processTurn = async (action: string, roll: number) => {
    setPhase(GamePhase.RESOLVING);
    
    // 1. Player Animation (Lunge)
    setPlayerAnim('animate-lunge-right');
    setTimeout(() => setPlayerAnim(''), 300);

    // Call AI
    const result = await generateTurnOutcome(player, enemy, action, roll, 20);
    
    // Update Log
    addLog(`Rolled ${roll}: ${result.narrative}`, roll > 15 || result.isCritical ? 'critical' : 'info');
    
    // 2. Apply Player Damage Effect
    if (result.damageToEnemy > 0) {
        setTimeout(() => {
            if (result.isCritical || result.damageToEnemy >= 20) {
                setEnemyAnim('animate-heavy-shake');
                setFlash(true);
                setTimeout(() => setFlash(false), 300);
            } else {
                setEnemyAnim('animate-shake'); 
            }
            setTimeout(() => setEnemyAnim(''), 500);
            
            addLog(`${enemy.name} took ${result.damageToEnemy} dmg!`, 'damage');
            setEnemy(prev => ({ ...prev, hp: Math.max(0, prev.hp - result.damageToEnemy) }));
        }, 300); // Delay slightly to sync with lunge
    } else {
        addLog("Attack missed!", 'info');
    }

    // Check Win
    if (enemy.hp - result.damageToEnemy <= 0) {
        setTimeout(() => {
            setPhase(GamePhase.VICTORY);
            addLog("Victory! The beast is slain.", 'critical');
        }, 1000);
        return;
    }

    // 3. Enemy Retaliation
    setTimeout(() => {
        // Enemy Lunge Animation
        setEnemyAnim('animate-lunge-left');
        setTimeout(() => setEnemyAnim(''), 300);

        setTimeout(() => {
            if (result.damageToPlayer > 0) {
                // Player Shake Animation
                if (result.damageToPlayer > 20) {
                    setPlayerAnim('animate-heavy-shake');
                    setFlash(true);
                    setTimeout(() => setFlash(false), 300);
                } else {
                    setPlayerAnim('animate-shake');
                }
                setTimeout(() => setPlayerAnim(''), 500);

                addLog(`${enemy.name} used ${result.enemyActionName}! Took ${result.damageToPlayer} dmg.`, 'damage');
                setPlayer(prev => ({ ...prev, hp: Math.max(0, prev.hp - result.damageToPlayer) }));
            } else {
                addLog(`${enemy.name} attacked but missed!`, 'info');
            }

            // Check Loss
            if (player.hp - result.damageToPlayer <= 0) {
                setPhase(GamePhase.GAME_OVER);
                addLog("Defeat... You blacked out.", 'damage');
            } else {
                // Reset for next turn
                setPhase(GamePhase.PLAYER_INPUT);
                setTimer(30); 
            }
        }, 300);
    }, 2000); // Wait for initial turn text to be readable
  };

  const addLog = (text: string, type: LogEntry['type']) => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), text, type }]);
  };

  const resetGame = () => {
      setPhase(GamePhase.START_MENU);
      setPlayer({ ...player, image: "" }); // Reset image to allow new selection next time
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0"
        style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1599739291060-45d8af97d299?q=80&w=2600&auto=format&fit=crop')", // Volcanic Lava
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.5) contrast(1.1)'
        }}
      />
      
      {/* GameBoy Container */}
      <div className="relative w-full max-w-2xl bg-indigo-700 rounded-b-3xl rounded-t-xl p-6 shadow-2xl border-b-8 border-indigo-900 z-10">
        
        {/* Screen Bezel */}
        <div className="bg-gray-700 rounded-t-xl rounded-bl-3xl rounded-br-xl p-8 pb-12 shadow-inner relative">
          
          <div className="flex items-center justify-center space-x-2 mb-2 opacity-50">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] text-white uppercase tracking-widest">Battery</span>
          </div>

          {/* Actual Screen */}
          <div className="bg-gray-100 border-4 border-gray-600 rounded-lg overflow-hidden h-[500px] flex flex-col relative shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            
            {/* Scanlines inside the screen */}
            <div className="scanlines z-50 pointer-events-none"></div>

            {/* Flash Effect Overlay */}
            {flash && <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none mix-blend-hard-light"></div>}

            {phase === GamePhase.START_MENU && (
               <div className="flex-1 bg-black flex flex-col items-center justify-center text-center p-8 space-y-8 relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 animate-pulse"></div>
                  <h1 className="text-4xl text-red-500 font-bold drop-shadow-[4px_4px_0_rgba(255,255,255,0.2)] z-10">DRAGON FIRE</h1>
                  <h2 className="text-sm text-yellow-400 font-bold tracking-[0.5em] z-10">DICE LEGENDS</h2>
                  
                  <div className="z-10 relative group">
                     <Dice rolling={isGeneratingOptions} value={20} variant="dragon" />
                  </div>

                  {isGeneratingOptions ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader className="animate-spin text-white" />
                        <span className="text-white text-xs animate-pulse">RECRUITING HEROES...</span>
                      </div>
                  ) : (
                    <button 
                        onClick={initializeSelection}
                        className="z-10 animate-bounce mt-8 px-6 py-3 bg-white text-black text-xl font-bold border-4 border-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase"
                    >
                        Press Start
                    </button>
                  )}
               </div>
            )}

            {phase === GamePhase.SELECT_CHARACTER && (
                <div className="flex-1 bg-gray-900 p-4 overflow-y-auto flex flex-col items-center relative h-full">
                    <h2 className="text-white font-bold text-center mb-4 uppercase tracking-widest text-lg border-b-2 border-red-500 pb-2 w-full">Select Your Hero</h2>
                    
                    {isLoadingImages ? (
                         <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                            <Loader className="animate-spin text-red-500 w-12 h-12" />
                            <p className="text-white text-xs font-mono animate-pulse">Summoning {player.name} & The Beast...</p>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 w-full max-w-md pb-4">
                            {warriorOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelectWarrior(opt)}
                                    className="bg-gray-800 border-2 border-gray-600 hover:border-yellow-400 hover:bg-gray-700 p-3 rounded flex items-center group transition-all text-left relative overflow-hidden"
                                >
                                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mr-4 border border-gray-500 group-hover:border-yellow-400">
                                        <User className="text-gray-400 group-hover:text-yellow-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-white font-bold text-sm uppercase group-hover:text-yellow-300">{opt.name}</span>
                                            <span className="text-[10px] text-gray-400 font-mono bg-gray-900 px-1 rounded">{opt.classType}</span>
                                        </div>
                                        <p className="text-gray-400 text-[10px] mt-1 italic leading-tight">{opt.description}</p>
                                    </div>
                                    <ChevronRight className="text-gray-600 group-hover:text-white w-4 h-4 ml-2" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {(phase === GamePhase.PLAYER_INPUT || phase === GamePhase.ROLLING_DICE || phase === GamePhase.RESOLVING || phase === GamePhase.VICTORY || phase === GamePhase.GAME_OVER) && (
                <>
                    {/* Battle Scene Layer */}
                    <div className="relative flex-1 bg-gradient-to-b from-blue-300 to-green-200 p-4 overflow-hidden">
                        
                        {/* HUD Enemy - Top Left */}
                        <div className="absolute top-4 left-4 z-20">
                            <HealthBar 
                                current={enemy.hp} 
                                max={enemy.maxHp} 
                                label={enemy.name} 
                                level={enemy.level}
                            />
                        </div>

                        {/* Enemy Sprite - Top Right / Center */}
                        {/* mix-blend-multiply makes the white background transparent against the light gradient */}
                        <div className={`absolute top-12 right-12 w-32 h-32 z-10 transition-transform duration-100`}>
                            {enemy.image ? (
                                <img 
                                    src={enemy.image} 
                                    alt="Enemy" 
                                    className={`w-full h-full object-contain mix-blend-multiply drop-shadow-lg ${enemyAnim}`} 
                                />
                            ) : (
                                <div className="w-full h-full bg-black/20 animate-pulse rounded-full blur-xl"></div>
                            )}
                        </div>

                        {/* Player HUD - Bottom Right */}
                        <div className="absolute bottom-6 right-4 z-20">
                            <HealthBar 
                                current={player.hp} 
                                max={player.maxHp} 
                                label={player.name} 
                                level={player.level}
                                isPlayer
                            />
                        </div>
                        
                        {/* Player Sprite (Back view) - Bottom Left */}
                        <div className={`absolute bottom-4 left-8 w-40 h-40 z-10 translate-y-4 transition-transform duration-100 ${playerAnim}`}>
                             {player.image ? (
                                 <img 
                                    src={player.image} 
                                    alt="Player" 
                                    className="w-full h-full object-contain mix-blend-multiply drop-shadow-lg" 
                                 />
                             ) : (
                                <div className="w-full h-full bg-black/20 animate-pulse rounded-full blur-xl"></div>
                             )}
                        </div>

                        {/* Visual Effects Overlay */}
                        {(playerAnim === 'animate-lunge-right' || enemyAnim === 'animate-lunge-left') && (
                            <div className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none"></div>
                        )}

                        {/* Timer Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-20 pointer-events-none">
                            <Timer size={120} className={timer < 10 ? "text-red-600 animate-ping" : "text-black"} />
                        </div>
                    </div>

                    {/* Mid Section: Dice & Info */}
                    <div className="h-24 bg-gray-800 border-t-4 border-yellow-600 flex items-center justify-between px-6 relative z-30">
                        {/* Message Box */}
                        <div 
                            ref={logContainerRef}
                            className="flex-1 h-full overflow-y-auto text-xs py-2 pr-4 text-white font-mono leading-relaxed"
                        >
                            {logs.map((log) => (
                                <div key={log.id} className={`mb-1 ${
                                    log.type === 'critical' ? 'text-yellow-400 font-bold' : 
                                    log.type === 'damage' ? 'text-red-400' : 'text-gray-300'
                                }`}>
                                    {'>'} {log.text}
                                </div>
                            ))}
                        </div>

                        {/* Dice Display */}
                        <div className="w-32 border-l-4 border-gray-600 pl-2 flex flex-col items-center justify-center bg-gray-900 shadow-inner h-full">
                            {phase === GamePhase.ROLLING_DICE || phase === GamePhase.RESOLVING ? (
                                <div className="flex flex-col items-center justify-center h-full w-full animate-in fade-in zoom-in duration-300">
                                    <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1 animate-pulse text-center leading-none">
                                        {selectedAction}
                                    </span>
                                    <div className="transform scale-75 origin-center">
                                        <Dice rolling={phase === GamePhase.ROLLING_DICE} value={diceValue} variant="dragon" />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <span className="text-[10px] text-gray-400 block mb-1">TIMER</span>
                                    <span className={`text-2xl font-bold ${timer < 10 ? 'text-red-500' : 'text-white'}`}>
                                        {timer}s
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="h-32 bg-gray-200 z-30">
                        {phase === GamePhase.VICTORY ? (
                            <div className="h-full flex items-center justify-center bg-yellow-100 text-yellow-800 animate-pulse">
                                <div className="text-center">
                                    <Trophy className="mx-auto mb-2 w-8 h-8" />
                                    <p className="font-bold text-lg">VICTORY!</p>
                                    <button onClick={resetGame} className="text-xs font-bold border-b-2 border-yellow-800 mt-1 hover:text-yellow-600">PLAY AGAIN</button>
                                </div>
                            </div>
                        ) : phase === GamePhase.GAME_OVER ? (
                            <div className="h-full flex items-center justify-center bg-gray-900 text-red-500">
                                 <div className="text-center">
                                    <RotateCcw className="mx-auto mb-2 w-8 h-8" />
                                    <p className="font-bold text-lg">DEFEATED...</p>
                                    <button onClick={resetGame} className="text-xs font-bold border-b-2 border-red-500 mt-1 hover:text-red-300">TRY AGAIN</button>
                                </div>
                            </div>
                        ) : (
                            <Menu 
                                onAction={handleAction} 
                                disabled={phase !== GamePhase.PLAYER_INPUT} 
                            />
                        )}
                    </div>
                </>
            )}
          </div>

          <div className="mt-4 flex justify-end items-center px-4">
            {/* Volume Control */}
            <div className="flex items-center space-x-2 bg-gray-800 p-1 px-3 rounded-full border border-gray-600 shadow-inner mr-4">
                <Volume2 size={14} className={`text-indigo-400 ${volume === 0 ? 'opacity-50' : ''}`} />
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none accent-indigo-500"
                />
            </div>

            {/* Speaker Grille */}
            <div className="flex space-x-1">
                 <div className="w-1.5 h-6 bg-gray-800 rounded-full shadow-inner border border-gray-900/50"></div>
                 <div className="w-1.5 h-6 bg-gray-800 rounded-full shadow-inner border border-gray-900/50"></div>
                 <div className="w-1.5 h-6 bg-gray-800 rounded-full shadow-inner border border-gray-900/50"></div>
                 <div className="w-1.5 h-6 bg-gray-800 rounded-full shadow-inner border border-gray-900/50"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}