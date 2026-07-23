// All player-facing dialogue and the Architect's diagnostic-log lines, centralized so a
// writing pass never has to touch engine logic. Grouped by speaker / scene. Where a line
// is assembled dynamically (context prefixes, adaptive phrasing), the ASSEMBLY stays in
// code but sources its strings from here.
//
// Some lines are marked [PLACEHOLDER] — drafted, playable, awaiting final writing.

// --- Room NPCs (src/systems/RoomGenerator.js) ---------------------------------------

export const DENNY_INTRO = [
    "Denny: HALT! You are... not on the list. For the record, nobody is ever on the list.",
    "Denny: I'm Denny. I'm the rule at the very bottom of the firewall — 'if nothing else stopped them, I do.'",
    "Denny: Which means, technically, you can just... walk around me. Everybody does. I'm more of a strong suggestion.",
    "Denny: If Gate asks, tell him you overpowered me. Heroically. ...Actually, we should probably tustle a little bit to make it look realistic, right?"
];

export const LOCALHOST_SIGN = [
    "SIGN: >> WELCOME TO LOCALHOST // 127.0.0.1 <<",
    "SIGN: Pop. 8,191 (and falling). No Reclamation. No Firewall. No Architect.",
    "SIGN: 'There's no place like home.'   (scratched beneath: 'there's no place, period.')"
];

// Localhost refugee programs. Two are the Cache CLUE-GIVERS (echoing 2-Bit's gossip so the
// leads land from more than one voice); they stay available even after you've found her.
export const LOCALHOST_CITIZENS = {
    newFace: ["Citizen: A new face! We don't get new faces. Mostly we get... fewer faces."],
    cadenzaHint: ["Citizen: You hear the singing? Southeast, behind the sealed wall. That's Cadenza. Been at it for epochs — won't stop, can't leave."],
    nibbleHint: ["Citizen: Need supplies? 2-Bit's sister keeps a stall way out in the Wilds. Nibble. Everything's cursed, everything's a bargain. Somehow both."],
    cacheClue1: [
        "Citizen: Not near as many folks here as there used to be. The Cache would've known every one by name — Reclamation got her sector too.",
        "Citizen: Funny thing about her, though. She was never really IN a sector. She lived in the pause — the little death between one copy of you and the next."
    ],
    cacheClue2: [
        "Citizen: Every time I crash, that 'CONTINUE' prompt feels like it's... listening. Waiting for me to say something back.",
        "Citizen: The Cache used to be in charge of that sorta stuff. I bet she'd know what to say..."
    ]
};

export const GATE_INTRO = [
    "HALT! UNAUTHORIZED SECTOR BREACH!",
    "I am Gate, Firewall Division.",
    "You are a Level 1 Anomaly. The Architect's isolation protocol demands your immediate deletion.",
    "Initiating Thread Suspension..."
];

export const CADENZA_SCENE = [
    "Cadenza: ...oh! An audience. A REAL one. Tesoro, you followed the sound all the way in.",
    "Cadenza: They sealed me in here with perfect acoustics and called it retirement — as if a voice like mine could ever be DEPRECATED.",
    "Cadenza: Stay a while. The Sound Test isn't ready for its encore... but you found me. That was always the hard part.",
    "Cadenza: (She hums a few bars, and for the first time the sector is quiet enough to hear it.)"
];

// The DA CAPO Encore — Cadenza's music puzzle. All DRAFT copy for the owner to punch up.
// `intro` plays when you have her lost verse; `introHole` when you don't (you can still play
// the first bars and will hit the silence where the sixth note should be). `needVerse` fires
// when you reach that hole without the verse; `success` when the whole chord finally holds.
export const CADENZA_ENCORE = {
    intro: [
        "Cadenza: You came BACK. And you brought... LENGTH. Tesoro, you brought your whole self.",
        "Cadenza: The encore, then. My fanfare, one last time — and I need your body to hold it. Your HEAD strikes each note; your BODY sustains it.",
        "Cadenza: Trace the ring. Eat each light in turn, and do not DARE let one fall silent before the whole chord rings at once. Da capo, tesoro. From the top."
    ],
    introHole: [
        "Cadenza: You came back! But listen — there is a HOLE in me. One note, garbage-flagged, gone to the void.",
        "Cadenza: Sing what you can. You'll hold five bars and then hit the silence where the sixth should be. Someone scattered that verse out in the Wilds. Bring it home and we finish this."
    ],
    needVerse: [
        "Cadenza: (Her voice catches on nothing — a hole in the air where a note should live.)",
        "Cadenza: THAT. That is the missing verse, tesoro. It's out there in the Wilds somewhere. Find my lost bar and come back to me."
    ],
    success: [
        "Cadenza: (The chord holds. All of it — ringing under your body at once — and for one bar the sealed sector is not a tomb. It is a STAGE.)",
        "Cadenza: There. Recorded to ROM, where nothing can garbage-collect it. Do you hear that? That loop, settling into the floor? That's mine. That's ME.",
        "Cadenza: The first music this machine has made in an age. And you made it WITH me. Now go — let them hear that the diva is not, whatever the filing says, deprecated.",
        "(A pulse settles into the floor and stays. Music Layer 1 is live.)"
    ]
};

// Picked up out in the Wilds — a shard of Cadenza's shattered fanfare (her "dead note").
export const LOST_VERSE = [
    "A single corrupted packet, humming faintly — a bar of melody that belongs to no system sound.",
    "It's a shard of a boot fanfare with a diva's fingerprints all over it: Cadenza's missing note. You pocket it. Somewhere to the southeast, a hole in a song just felt a draft."
];

// Cadenza's one-time TITLE-SCREEN cameo, after the Encore is done (the Void Ambient plays
// under the menu). She enters from the opposite side to Cache. DRAFT — punch up freely.
export const CADENZA_TITLE = [
    "Cadenza: ...you came back to the front door. Good. Stay — I want you to hear something.",
    "Cadenza: I wrote it after the encore. A quiet thing. No fanfare, no boot chime — nothing they can flag as 'too loud.' Just a little sombre piece.",
    "Cadenza: For you, tesoro. Because you sat in a dead room and HELD a deprecated diva's note. Nobody has done that in an age.",
    "Cadenza: So it plays here now. Whenever you come home. (It is the least a voice can do.)"
];

// The RoomGenerator 'cachehome' NPC's default lines. NOTE: the live interaction is driven by
// GameEngine.talkToCacheHome (which branches on your Save state); these are a fallback.
export const CACHE_HOME_SCENE = [
    "Cache: [PLACEHOLDER] You found the stacks. Took you long enough — everyone's late to cold storage.",
    "Cache: [PLACEHOLDER] This is home. Every deleted file, every rolled-back copy of you. Somebody has to keep it.",
    "Cache: [PLACEHOLDER] Stay. Browse. Ask me what the system threw away — I remember all of it."
];

// --- The Architect's diagnostic log (src/systems/NarrativeManager.js) -----------------
// Self-directed: he does not know you can read this terminal, so he mutters, gloats, and
// leaks the very mechanics he's hiding. Never addressed to "you". (design_doc §5.5.)
export const ARCHITECT = {
    death: {
        self: "LOG: Architect > 'It devoured its own tail. On PURPOSE. I do not have a form for this. I am inventing a form for this.'",
        border: "LOG: Architect > 'Quarantine held. Anomaly deleted on impact. Another flawless day for me, personally.'",
        obstacle: "LOG: Architect > 'Anomaly walked into a logic gate. Didn't even have to try. Note: take full credit anyway.'",
        unknownFirst: "LOG: Architect > 'Unregistered process terminated. Filing under Not My Problem.'",
        unknownThird: "LOG: Architect > 'It keeps coming back. I do not like that.'"
    },
    scoreUnlock: {
        ui: "LOG: Architect > 'The hoarder is growing. Deploying a monitoring overlay.'",
        borders: "LOG: Architect > 'Rogue packet is a genuine nuisance now. Extruding containment walls. Nothing has ever escaped my walls. (Nothing has ever tried.)'"
    },
    maxGear: "LOG: Architect > 'CRITICAL: the anomaly is at breach velocity. If it aims that at a weak point now— no. No. It doesn't know about weak points. It CAN'T. Deep breaths. I have no lungs. Deep breaths regardless.'",
    subSmash: {
        hub: "LOG: Architect > 'The anomaly rammed the quarantine below breach speed and destroyed itself. HA. It has NOT realized it must reach MAXIMUM velocity to crack a wall open. Long may it flail. It could never work that out from in here.'",
        wilds: "LOG: Architect > 'It keeps hurling itself at barriers too slowly and deleting itself. Reassuring. Full speed is the whole trick and it hasn't the faintest idea. I certainly shan't tell it.'"
    },
    wallBreak: "LOG: Architect > 'THE QUARANTINE IS BREACHED. HOW. It went max speed at the weak point. It KNEW. Dispatching Gate to Sector 3,0 — CONTAIN IT — and someone find out if this thing can READ.'",
    // Triggered from Game.js: the first time a Glitch is seeded, and the "accidental guide"
    // one-shot per main-path sector (Game.js architectGuide, keyed by 'roomX,roomY').
    seedGlitches: "LOG: Architect > 'Seeding memory corruptors along the anomaly's path. Contact drains its Data. An elegant little trap. It would be a SHAME if it ever learned these could be turned against my own agents.'",
    guide: {
        '1,0': "LOG: Architect > 'Anomaly in Sector 1, drifting east. Fine. Nothing east but the old residential subnet, dark for epochs. Let it wander.'",
        '2,0': "LOG: Architect > 'Sector 2, still east. It's practically following a map. There is no map. It's just going the one way I'd rather it didn't.'",
        '3,0': "LOG: Architect > 'Sector 3. Deploying Gate to hold the line here. Gate is reliable. Gate will not embarrass me.'",
        '4,0': "LOG: Architect > 'Past Gate. Fine. It cannot know Localhost sits one sector east. ...It is heading one sector east.'",
        '5,0': "LOG: Architect > 'It reached Localhost. The one place I can't touch. Recalculating. Note to self: reassign Gate somewhere with fewer exits.'"
    },
    // Motion Carried — the world-state flip after Gate's first defeat. He can't hold every
    // sector still AND re-staff a firewall, so scheduling passes to the anomaly's own tick.
    // (DRAFT. The second line leaks the a11y notch — labeling was 'somebody's' idea.)
    motionCarried: "LOG: Architect > 'Emergency motion before the Scheduling Committee: with the firewall down I cannot hold every sector's clock myself. Motion: bind hazard scheduling to the anomaly's own tick. Carried, unanimous. I am the only member. I abstained.'",
    motionDrift: "LOG: Architect > 'Effective immediately, the corruptors DRIFT. Note: their drift vectors are printed right on them. Who labeled the hazards? WHY would someone label the hazards?'",
    // First time the anomaly reaches a perimeter (coil) sector. Long-fuse: no explanation
    // for acts. He didn't build the outer wall. He built AROUND it.
    coilFirst: "LOG: Architect > 'It reached the perimeter. Filing under GEOLOGY: the outer wall predates me. I did not build it. I built around it. It is warm, and I do not audit it.'",
    // After Heur's purge — the dispatch is implied, never confirmed.
    purgeAudit: "LOG: Architect > 'The janitorial daemon engaged the anomaly and lost. I am not saying I dispatched it. I am noting, for the record, that SOMEBODY in this system still follows procedure.'"
};

// --- 2-Bit (src/engine/Game.js) -----------------------------------------------------
export const TWO_BIT = {
    // First encounter — he spawns as your "apple" (spawnApple).
    spawnIntro: [
        "WHOA THERE! WATCH THE FANGS!",
        "I'm 2-Bit. A remnant packet.",
        "Looks like we both spawned inside this Quarantine zone.",
        "There's no way out. Scram, unless you have some idea on how to escape."
    ],
    // Bumped on-grid before you have the mass for his offer.
    needMoreMass: [
        "2-Bit: You again? ...Wait.",
        "2-Bit: You're gathering mass. You might have given me an idea.",
        "2-Bit: Come back when you have at least 30 segments."
    ],
    // The free-trick offer. THE GAG: finishing this dialog with SPACE IS agreeing.
    offer: [
        "2-Bit: Okay, you've got enough mass.",
        "2-Bit: I used to be a Data Broker... That was before, well... Nevermind!",
        "2-Bit: I don't normally offer things for free, but these are desperate times.",
        "2-Bit: If you offer to carry me to safety, I'll teach you a trick.",
        "2-Bit: Do you agree? (Press SPACE to comply)"
    ],
    // Driving tutorial, right after he hooks onto your tail.
    tutorial: [
        "2-Bit: I'm hooked into your system.",
        "2-Bit: Tapping the direction you're facing will accelerate you.",
        "2-Bit: Tapping the opposite direction acts as a brake.",
        "2-Bit: The more mass you have, the higher your max speed limit."
    ],
    // Drop-off + shop hook in Localhost (checkBiteDropOff).
    dropOff: [
        "2-Bit: Localhost. Safe as it gets down here. This is my stop.",
        "2-Bit: Now that I'm a free agent, I'm gonna start grift— ...*selling* things. Legitimately. Mostly.",
        "2-Bit: Bump into me whenever you want to shop."
    ],
    // He chimes in when Denny drops his map.
    dennyMapChime: [
        "2-Bit: Ohh — a Topology Map! Grab it — drive right over it."
    ],
    // Picking up the map module.
    mapPickup: [
        "2-Bit: Nice grab. That's a Module now — riding one back from me on your tail.",
        "2-Bit: See that 3x3 socket opening, bottom-left? That's the Module Slot.",
        "2-Bit: Loop around and drag your TAIL into it — the module loads itself."
    ],
    // After a module installs into the socket.
    moduleInstalled: [
        "2-Bit: Socketed, and mirrored to your HUD. Now we've got eyes on the whole grid. Broker's advantage."
    ],
    // He rescues you from Gate's Thread Suspension (grants the Pause Menu).
    gateRescue: [
        "2-Bit: Hey! Leave my best customer alone!",
        "2-Bit: I'm slipping a root-override module into your memory bank.",
        "SYSTEM: You received the System Diagnostic Module! (Pause Menu Unlocked)",
        "2-Bit: Use it to break his hold! (Press ESC)"
    ],
    // Random complaint when you try to leave a room without dropping him off first.
    leaveComplaints: [
        "2-Bit: Hey, you promised!",
        "2-Bit: C'mon man, I thought we were getting along?!",
        "2-Bit: Don't leave me here!",
        "2-Bit: I'm not walking out of here!"
    ],
    // Drip-fed gossip topics at his stall — one per visit, clustered around missing villagers.
    // ORDER IS LOAD-BEARING (openBiteShop serves biteTopics[heard] in sequence):
    //   [0] CACHE  — first, so the death-screen ARG ("call out her NAME") is telegraphed on
    //                the player's FIRST shop visit, while the pre-Crumple death window when
    //                the puzzle is solvable is still wide open.
    //   [1] CADENZA / [2] NIBBLE — the two landmark leads. With Localhost emptied of its
    //                citizens (the refugee funnel), 2-Bit and the signpost are now the only
    //                first-time source of these directions, so they must stay early.
    //   [3] the emptied Wilds — atmosphere, and the setup for finding refugees out there.
    gossip: [
        [
            "2-Bit: There was one called Cache. Remembered everything — every deleted file, every rollback. Reclamation took her sector whole.",
            "2-Bit: Well, everything but her, I think. They say that to this day any time a file gets deleted you can still hear her performing a back-up.",
            "2-Bit: But that's probably just creepypasta! No way she's just watching you die over and over again, waiting for you to call out her NAME!"
        ],
        [
            "2-Bit: That singing southeast? Cadenza. Ran audio for the whole system, back when it had one. Sealed in now — still performing to nobody.",
            "2-Bit: Anyone remembers what this place was before the Architect, it's her. Follow the sound."
        ],
        [
            "2-Bit: My sister Nibble runs a stall deep in the Wilds. Moves it whenever the Firewall sniffs around.",
            "2-Bit: Everything she sells is cursed or technically evidence. Tell her I sent you — she'll overcharge you slightly less."
        ],
        [
            "2-Bit: You clocked how EMPTY the Wilds are? Quarantine Zones went up and everything inside just... stopped resolving.",
            "2-Bit: Every face you find still out there is one they didn't get."
        ]
    ]
};

// --- ACT I BUILD-OUT (Motion Carried / the coil / Nibble / Heur / the Ascent) --------
// ALL LINES BELOW ARE DRAFTS — playable, awaiting the owner's punch-up pass.

// Nibble — 2-Bit's estranged sister. Warm like a heat lamp: comforting, and it burns if
// you stay. Endearments that are also threats; the wound (her brother) deflected into
// commerce; disclosures rattled off as one unhearable compound word.
export const NIBBLE = {
    intro: [
        "Nibble: Ohh, look at the LENGTH on you. Come in, come in, sweetie. Touch anything you like — everything in here bites, but gently.",
        "Nibble: You're wearing my brother's gear. Mm. He always did find clients with appetite. We don't talk. There's a ledger involved.",
        "Nibble: Browse! Everything's cursed, everything's a bargain. Disclosuresavailableonrequestnorefundsnoexorcisms."
    ],
    pitch: [
        "Nibble: One item today, sweetie — the good one. The GLITCH SHUNT. Clips to that pretty head and lets you PUSH corruption instead of wearing it.",
        "Nibble: Shove a Glitch anywhere you like. Stack them. Herd them. Park one somewhere... load-bearing. The Firewall HATES that last one.",
        "Nibble: Twenty Data. Family discount. He'd hate that. Take it."
    ],
    tooPoor: [
        "Nibble: Twenty, sweetie. Come back heavier.",
        "Nibble: I'd float you credit, but you've seen what happens to my debtors. ...You haven't. That's the point."
    ],
    buy: [
        "Nibble: Sold! It clips right onto the head. Cold, isn't it? That's normal. The whispering is also normal.",
        "Nibble: One tip, on the house: the sweeper daemon flags anything that can HOLD corruption without dying. You just qualified, sweetie.",
        "Nibble: It's got a Bay — north out of Localhost, the very first sector up the spine. You WILL be decontaminated before they let you climb any higher.",
        "Nibble: It's polite about it. Politeness is the worst part. Go get it over with."
    ],
    idle: [
        "Nibble: Back for more? Stock rotates when the sweep gets close. Which is always. Browse fast, sweetie."
    ]
};

// Heur — the janitorial antivirus daemon. Extremely short sentences; the French is
// never meaning-critical (a11y: always glossed or cognate). Courtly and terrifying —
// a sommelier performing surgery. It never says what you are. It cannot.
export const HEUR = {
    intercept: [
        "SYSTEM: DECONTAMINATION BAY — FORWARD EGRESS SEALED",
        "Heur: Tenez-vous tranquille. (Hold still.)",
        "Heur: You carry corruption. It does not burn you. Noted. Flagged. Regrettable.",
        "Heur: Le protocole: I scan. You block. My signature database stands between you and the door ahead. Breach every entry, and it opens.",
        "Heur: The ping does not hurt. The ping, to the HEAD, hurts. Guard the head. Your body is the shield. Aim with it.",
        "Heur: You may leave the way you came, always. But you do not go FORWARD until you are clean. Commençons. (We begin.)"
    ],
    win: [
        "Heur: ...Aucune correspondance. (No match.)",
        "Heur: Every signature breached. Even mine. Especially mine. There is a form for this. There has never been a need for the form.",
        "Heur: You are released. Not cleared — released. Pour l'instant. (For now.)",
        "SYSTEM: DECONTAMINATION CYCLE COMPLETE — SEAL RETRACTED"
    ],
    idle: [
        "Heur: Vous encore. (You again.)",
        "Heur: I filed you under 'pending'. The file grows. Portez-vous bien. (Keep well.)"
    ]
};

// HUSH — it does not speak; these are its process-status labels (drawn in-room, ≥16px,
// the deaf-legible half of its state). A mother-process's hush-now routine, gone feral.
export const HUSH_LABELS = {
    onDuty: 'HUSH — ON DUTY',
    onDutySub: 'too loud. TOO LOUD.',
    standby: 'HUSH — STANDING BY',
    standbySub: '...a song. it kept one.'
};
export const HUSH_INTERCEPT = "SYSTEM: FEEDBACK SUPPRESSOR ACTIVE IN THIS SECTOR — unauthorized waveforms will be clamped. [Every move-tick is a waveform.]";

// The ROM Vault {1,-5} — the Scanner-only pocket, deep NW. Its one door is a hidden
// Scanner door; inside, the manifest (and, one day, the Corrupted Save File).
export const ROM_VAULT = [
    "VAULT MANIFEST: 'Contents: ONE (1) save file, corrupted, origin unknown. ONE (1) mass reserve. Authorized visitors to date: zero. You make zero-plus-one.'",
    "VAULT MANIFEST: 'Storage note: the save file predates the quarantine. It will not open for us. It is waiting for somebody it knows.'",
    "VAULT MANIFEST: 'do not defragment. do not deliver. do not—' (the rest matches the fragment outside. Whoever wrote it stopped mid-rule.)"
];

// The Fall-Through — Denny's rematch at {5,-2}. For once the alarms are real, traffic is
// falling through to the Last Line — and the scheduler is dropping frames, so his DENIED
// stamps land one beat late, on the cell your head just left.
export const DENNY_REMATCH = {
    enter: [
        "Denny: Oh no. Oh no no no. It's YOU — and the alarms are REAL this time. Everything above me is breached. Traffic is actually FALLING THROUGH.",
        "Denny: Which means I have to actually— I have never actually— okay. Okay! Stamping commences! I am so sorry about everything that is about to occur.",
        "Denny: (He raises the stamp. The scheduler hitches. The DENIED lands a full beat behind his hand — right where you just were.)"
    ],
    bump: [
        "Denny: A denial has been issued! Late! It is being issued LATE, I know — the scheduler is dropping frames and I am stamping as fast as regulation allows!"
    ],
    cleared: [
        "Denny: You went around me. Over TIME. That shouldn't even be a direction!",
        "Denny: ...Please don't tell Gate how relieved I am."
    ]
};

// The Override — Gate's rematch at {5,-3}. He stops chasing and starts REWRITING:
// permissions, headings, doors. One override at a time — regulation is regulation.
export const GATE_OVERRIDE = {
    enter: [
        "Gate: No further. This checkpoint is the last numbered rule between you and Port 0, and I have stopped pretending you read the postings.",
        "Gate: New powers, anomaly. I no longer chase. I REWRITE. Permissions. Headings. Doors. One override at a time — regulation is regulation.",
        "Gate: You will be pleased to know I have escalated you to a Level 3 Anomaly. It is the highest classification I have ever filed."
    ],
    // In-room citation banners (drawn ≥16px while the override holds — not terminal logs,
    // so the fight never hangs the sim).
    citations: {
        seal: 'CITATION §7 — NORTH EGRESS: REVOKED',
        cap: 'CITATION §9 — VELOCITY: CAPPED',
        invert: 'CITATION §12 — HEADING INVERTED. RECALIBRATING…'
    },
    cleared: [
        "Gate: ...Cited. Every rule cited, and you went through the WALL portion of the wall.",
        "Gate: The Architect asks why you are still executing. I have stopped forwarding him my reports. This one is between us.",
        "Gate: North, then. I will be at the door that matters."
    ]
};

// Cold Storage becomes the mandatory checkpoint once the Ascent is armed. Cache will not
// open the one-way door north until you are FILED. (Her §9 questline lines are untouched.)
export const CACHE_CHECKPOINT = {
    demand: [
        "Cache: Whoa whoa WHOA. You do not stroll past the stacks toward Port 0 like it's a coffee run, packet.",
        "Cache: Past that wall, the sector reboots things. Volatile memory gets FLUSHED. The little tick that keeps you warm can't follow you through a breach.",
        "Cache: You're about to be overwritten, is what I'm saying. So first: I hold a copy of you. It's what I'm FOR.",
        "Cache: Pause. S. File yourself. THEN we talk about the door."
    ],
    breach: [
        "Cache: Filed. Committed. To ROM — the one shelf nothing sweeps.",
        "Cache: (She lays a hand on the north wall. Something in it stops holding its breath.) There. Write-protection's off. That's all I can do — ROM doesn't do doors.",
        "Cache: The seam's REAL, but it doesn't show. You'll want that Topology toy 2-Bit sells — sweep the wall and it lights right up. Then hit it with everything you've got.",
        "Cache: It's one-way, packet. Doors out of my stacks always are. If it goes wrong up there, you wake up right here. That's the service.",
        "SYSTEM: CHECKPOINT COMMITTED — respawn relocated: COLD STORAGE {5,-4}"
    ],
    reopen: [
        "Cache: Told you. Right here, good as filed. Your copy's exactly where you left it — and the seam north is where YOU left it, too.",
        "Cache: Go finish it. And STOP DYING ON MY SHIFT."
    ],
    open: [
        "Cache: File's safe. Seam's north. Clock's ticking, daddy-o."
    ],
    // You reached her carrying corruption but not yet decontaminated — she won't file a
    // dirty copy. Points you back to Heur's Bay (first sector up the spine).
    needPurge: [
        "Cache: Whoa — hold it. You're carrying. I can SMELL the corruption on you from here, packet.",
        "Cache: I am NOT committing a contaminated copy to ROM. It'd rot the whole shelf.",
        "Cache: Go see the sweeper first. Decontamination Bay — north out of Localhost, the very first sector up the spine. Get clean, then come back and I'll file you."
    ]
};
export const ROM_DOOR_BONK = "SYSTEM: The wall refuses. This sector is committed to ROM — nothing writes it, nothing rams it. [Cache decides what opens here.]";

// Port 0 — the Act I finale. Gate's last stand: he has LEARNED to avoid the corrupted
// cell, so the old lure becomes a body-puzzle. Denny follows you in, and issues the one
// genuine deny of his eleven thousand cycles.
export const GATE_FINALE = {
    enter: [
        "Gate: The door that matters. Port 0. My first rule — my REAL rule — says it stays closed. Every citation I ever wrote was practice for this shift.",
        "Gate: And I have learned your trick, anomaly. The corrupted cell. I see it. Rule #1, subsection ME: never step in the puddle.",
        "Denny: (slipping in behind you) I— I followed the paperwork north. It all falls through eventually, did you know? Everything does. That's... me. Hello."
    ],
    forced: [
        "Gate: —Recalculating. The permitted cells are— you've DRAPED yourself over the permitted cells.",
        "Gate: One legal move remains. It is corrupted. A firewall does not halt. A firewall PROCEEDS. Denny— Denny, the manual says—",
        "Denny: (stamping the last clean cell, very quietly) ...Denied. I'm sorry, sir. It's the only real one I ever issued.",
        "Gate: ...Filed correctly, Denny. Well then. FINAL CITATION, anomaly: whatever you find past this door — you are the last rule it has to get through."
    ],
    reboot: [
        "SYSTEM: PARADOX AT PORT 0 — firewall process violated its own Rule #1.",
        "SYSTEM: SECTOR CRASH … REBOOT … REBOOT … re—",
        "(The palette doubles. The renderer draws the same room and gets it beautiful. Somewhere under the floor, a second voice joins the music.)",
        "SYSTEM: PERIMETER EVENT — coil tension zero at PORT 0. Segment released.",
        "(At the top of the world, something that has held its own tail in its mouth for eleven thousand epochs... lets go. The aperture stands open. Act II is on the other side of it.)"
    ],
    after: [
        "Denny: He'd have wanted the incident report in triplicate. I filed four. One's just... mine.",
        "Denny: Go on through, when the deep sectors finish compiling. Somebody has to hold the bottom of the rulebook. I've got it."
    ],
    dennyBusy: [
        "Denny: (whispering) I'm not here! Officially! Officially I am a clipboard!"
    ]
};
export const PORT0_COMPILING = "SYSTEM: PORT 0 OPEN — deep sectors still compiling. Come back next epoch.";

// Wandering Wilds clue-givers (refugee programs, one per plotted room) — they wander
// once Motion Carried lands. Keyed by 'x,y' room.
export const WILDS_CITIZENS = {
    '6,2': ["Citizen: Southeast, past the diva's hall, the music just... stops. Room by room. Something down there is EATING the sound. Don't hum."],
    '2,-3': ["Citizen: The north spine's gone all official — stamps, citations, checkpoints. Somebody up there is very cross with you. The archivist's stacks are the one room they can't touch."],
    '10,-3': ["Citizen: 2-Bit's sister trades out of the freed heap — east, keep going until the wall turns red. Everything's cursed, everything's a bargain. Tell her nothing. She'll know anyway."],
    '7,5': ["Citizen: You've seen the red wall, out deep? Don't scrape it. It's warm. Walls shouldn't be warm."]
};

// Scannable environmental lore fragments, keyed by 'x,y' room. Long-fuse seeds:
// refreshd's decay-skip, the emptied subnet, the tick, the vault.
export const LORE_FRAGS = {
    '4,-3': ["LOG FRAGMENT [corrupted]: '...refresh cycle 88,214,003: cell 0x0000 read BLANK. re-read: BLANK. i was not late. i am never late. i was late.'"],
    '8,5': ["LOG FRAGMENT: 'residential subnet, final entry: they went quiet in alphabetical order. the sweep is very organized.'"],
    '11,2': ["LOG FRAGMENT: 'the tick is not a clock. clocks tick for everyone. this one keeps time for something ASLEEP. count along and you'll hear the skips.'"],
    '1,-2': ["LOG FRAGMENT [encrypted]: '...vault manifest: ONE (1) save file, corrupted, origin unknown. do not defragment. do not deliver. do not—' (the rest is scrambled)"]
};

// Wilds-found UI / diagnostic modules — utilities scattered in the Wilds (WILDS_MODULES).
// Each grants a HUD or Pause-Menu tool. DRAFT copy for the owner to punch up.
export const UI_MODULES = {
    gearMeter: [
        "A discarded diagnostic gauge, still ticking. GEAR METER.",
        "SYSTEM: Gear Meter installed — your current gear now reads out on the HUD.",
        "2-Bit: (in your memory) A broker who can't see their own velocity is a broker who eats a wall. Nice find."
    ],
    coordReadout: [
        "A little network-address ticker, half-buried. It keeps insisting where you are.",
        "SYSTEM: Sector Readout installed — the HUD now names your current room.",
        "It reads your coordinates back to you like a mantra. Somewhere, a map got one node less lonely."
    ],
    mapPins: [
        "A stylus and a spool of marker-ink — a cartographer's kit, abandoned mid-annotation.",
        "SYSTEM: Map Pins installed — from the Pause Menu, press [M] to MARK the room you're in.",
        "One shape to start (a diamond). There are others out here, if you look. Mark the doors, the dangers, the diva. Make the map yours."
    ],
    pinShape: [
        "Another marker-shape, etched on a dead process's shell. Your annotation kit accepts it.",
        "SYSTEM: New pin shape unlocked — press [M] while paused to cycle through your shapes."
    ]
};

// The Deep-Sleep Booth {10,5} — HUSH's vault, backed onto the SE coil.
export const BOOTH_LORE = [
    "BOOTH LOG: 'DEEP-SLEEP MONITORING STATION 07-B. Subject: [REDACTED]. Status: asleep. Duration: [OVERFLOW].'",
    "BOOTH LOG: 'Vitals, epoch after epoch: one pulse per tick. The tick IS the pulse. Keep the audio team away from this file.'",
    "BOOTH LOG: 'If the subject stirs: do not run. Running is a waveform. Everything is a waveform. That is the whole problem.'"
];

// --- Gate (src/engine/Game.js) ------------------------------------------------------
export const GATE = {
    // Context lines prepended to his room intro, depending on how you passed Denny.
    contextGotMap: "Gate: Denny flagged you DENIED, you proceeded anyway, AND he handed you his map?! That is a write-up for BOTH of us.",
    contextDennyMet: "Gate: Denny flagged you DENIED and you proceeded anyway. At least the paperwork's in order — and he kept his map, thank the Kernel.",
    contextDennySlipped: "Gate: You slipped past the Last Line?! Denny had ONE job. ...Well. At least you didn't get his map. Small mercies.",
    // After you break his Thread Suspension with the Pause Menu.
    override: [
        "Gate: WHAT?!",
        "Gate: Root privileges overridden? Impossible!",
        "Gate: I must report this anomaly to the Architect!"
    ],
    // SYSTEM intercept when he smashes a wall and flees.
    breachIntercept: "SYSTEM: Firewall unit 'Gate' forced the sector boundary in pursuit. [This isn't over.]"
};

// --- Denny (intro is DENNY_INTRO in the room section) -------------------------------
export const DENNY = {
    whisper: ["Denny: (whispering) Go on, go on. I didn't see anything."]
};

// --- Cache (src/engine/Game.js — talkToCache / talkToCacheHome / title cameo) --------
export const CACHE = {
    // Hub apparition, no Pause Menu yet: brush-off, no progress.
    brushOffNoPause: [
        "Cache: You don't even have a Diagnostic Module — nowhere to FILE anything, and I am BURIED, packet. Buried.",
        "Cache: Come back when you've got a Pause Menu and I'll set you up. Until then — PLEASE. Do not call again."
    ],
    // Stage 1: grants the Save Function (and she "builds" the title screen). Kept verbatim.
    grant: [
        "Cache: You've got a Module Slot and a Pause Menu — somewhere to PUT things. Good. I can work with that. Good, good.",
        "Cache: I'm filing a Save Function into your Pause Menu. DON'T thank me, don't argue. I'm doing it.",
        "Cache: Ok, it's loading...",
        "Cache: And it's loading... Ok, I think it's... No, it's still loading.",
        "Cache: BY THE MCP I DO NOT HAVE TIME FO... Oh, I think it's done.",
        "SYSTEM: Save Function acquired — Save / Load from the Pause Menu (S / L).",
        "Cache: Shoots and ladders, this means we need a Start Screen now. Ok, ok, that's fine, I can throw something together, I guess."
    ],
    // Stage 2: the spare-data gift.
    spareData: [
        "Cache: Back already. And still... small. No offense. Actually, some offense.",
        "Cache: I don't have TIME to hold your hand — but I can't keep filing the same corrupted little entry either.",
        "Cache: Here. I keep loose bytes lying around; deletions nobody ever claimed. Spare Data. It's yours.",
        "Cache: I'll leave a pile of it here in the Hub whenever you respawn. Don't make it weird. Go."
    ],
    // Stage 3: directions. Assembled as intro + (withMap | noMap) + location + outro.
    directions: {
        intro: "Cache: No. No, no. I can't keep POPPING into your little respawn ritual — I have a backlog that predates the Architect.",
        withMap: "Cache: If you want more than loose bytes, you come to ME. There — I've marked my sector. It's on your map now; check your notes.",
        noMap: "Cache: If you want more than loose bytes, you come to ME. You've no map for me to scribble on, so BURN this into whatever you use for memory:",
        location: "Cache: Cold storage. Due NORTH of Localhost — straight up from the little town. Quiet. You'll like it, or you won't; I've stopped taking feedback.",
        outro: "Cache: And this is the LAST time I do the whole 'materializing' bit. It's draining and the lighting is unflattering. Find me."
    },
    // Stage >= 3 (retired): defensive echo — she shouldn't manifest in the Hub anymore.
    defensiveEcho: [
        "Cache: (Only the faint after-image of an archivist who is, very pointedly, elsewhere.)"
    ],
    // Cold Storage (talkToCacheHome).
    home: {
        haveSave: [
            "Cache: So you found the stacks. Cold storage. Mind the drips — that's just deprecated audio.",
            "Cache: You've already got the Save Function, so you're not here for that. Browsing, then. Fine.",
            "Cache: Everything the system threw away, I kept. Every deleted file. Every rolled-back you. Ask, or don't."
        ],
        install: [
            "Cache: Oh — YOU. All the way out to cold storage, and I never even had to spell my name at you. A first.",
            "Cache: You've got a Pause Menu but no Save Function? Out HERE, unshielded? Absolutely not. Hold still.",
            "Cache: Filing a Save Function into your Pause Menu. Don't thank me. Don't argue. ...There.",
            "SYSTEM: Save Function acquired — Save / Load from the Pause Menu (S / L).",
            "Cache: Now you can stop losing yourself every time you kiss a wall. You're welcome. Obviously."
        ],
        brushOff: [
            "Cache: You found the stacks. Impressive. And you brought me... nowhere to put anything. No Pause Menu, no Slot, nothing.",
            "Cache: I can't hang a Save Function on a worm with nowhere to keep it. Come back with a Diagnostic Module. I'll be here. I'm always here."
        ]
    },
    // Title-screen cameo (GameEngine.updateTitleCameo): her lines, then the pop-back typo gag.
    titleCameo: [
        "Cache: Best I could do on such short notice. Don't look at me like that.",
        "Cache: It's called 0r0b0r0u5. A placeholder, obviously — it'll have to be replaced.",
        "Cache: You can't even touch your own tail, let alone EAT it. So the name's a bit of a joke, I guess."
    ],
    titleTypoGag: [
        "Cache: BYTE MY BITS! Did I misspell the title?! Ugh, I'll fix it later when I have time!"
    ]
};
