<div align="center">

<img src="images/logo.png" alt="Lobo icon" width="128">

<h1>Lobo</h1>

<p><b>Spin. Clash. Ring them out.</b><br>
A 3D spinning-top battle game you play in the browser, steering by tilting your phone.</p>

<p><a href="https://atymia.github.io/Bey-Arena/"><img src="https://img.shields.io/badge/▶%20play%20now-in%20your%20browser-ffb627?style=for-the-badge&labelColor=11151d" alt="Play now in your browser"></a></p>

<p><img src="https://img.shields.io/badge/iPhone-supported-2c3546?style=flat-square&logo=apple&logoColor=white" alt="iPhone">
<img src="https://img.shields.io/badge/Android-supported-2c3546?style=flat-square&logo=android&logoColor=white" alt="Android">
<img src="https://img.shields.io/badge/desktop-supported-2c3546?style=flat-square&logo=googlechrome&logoColor=white" alt="Desktop">
<img src="https://img.shields.io/badge/version-v47-ffb627?style=flat-square" alt="Version v47"></p>

<p><a href="#-how-a-battle-works">How it works</a> ·
<a href="#-the-beys">The beys</a> ·
<a href="#-modes">Modes</a> ·
<a href="#-controls">Controls</a> ·
<a href="#-on-your-phone">On your phone</a></p>

<img src="images/banner.jpg" alt="Dragoon's tornado and Dranzer's flame dash in the stadium" width="100%">

</div>

---

Lobo is a little hobby project of mine: a battle game about spinning tops, inspired by the first Beyblade series (plus Zeus from G-Revolution, because I couldn't leave him out). You pick a bey, launch it into the stadium and steer it around, trying to knock your opponent out of the ring or just outlast it.

You can play it with a joystick on screen, but on a phone you steer by **tilting the phone**, and that's really how it's meant to be played.

No downloads, no accounts. Open the link and play.

## ⚡ How a battle works

Every bey starts at full spin, and spin is your health. It drops slowly on its own and a lot faster every time you get hit. A round ends when a bey stops spinning, when it gets knocked into one of the KO pockets in the wall, or when time runs out (then whoever has more spin left wins). First to win 2 rounds takes the match.

The one thing I really wanted: **you win the fight, not your bey's stats.**

- **How you hit matters most.** The faster you're going when you crash into the other bey, the more spin it loses. Whoever charges in deals most of the damage, so waiting around doesn't pay.
- **Stats are just flavour.** A defense type is harder to push, an attack type is quicker, but stats only change damage by a few percent. Picking Dranzer over Draciel won't win the match for you.
- **Grinding doesn't count.** Two beys rubbing against each other won't keep draining spin. Clean hits do.
- **Every special can be dodged.** There's always a warning first: a target on the ground, lightning markers, a ring closing in. Move in time and it misses.

To make sure no bey is just better than the rest, I had the CPU play thousands of battles against itself on the real game code. At the same skill level, every bey wins roughly 40–60% of its games.

## 🌀 The beys

Every bey has a **base move**, which recharges fast, is aimed when you press it and can miss (landing it charges your special faster), and a **special move**, the big one, which charges up during the fight.

| Bey | Base move | Special move |
|---|---|---|
| **Dragoon** | **Gale Trail**: a dash that leaves a gust behind, and crossing it blows the opponent sideways | **Sky Tornado**: a tornado follows Dragoon, lifts the opponent up and throws it wherever you steer |
| **Dranzer** | **Flame Arc**: a dash that curves towards the opponent | **Phoenix Dive**: Dranzer flies up, you aim a target on the ground and it dives. Dodge it and Dranzer is left stunned |
| **Black Dranzer** | **Dark Claw**: the strongest dash, but missing costs some of its own spin | **Eclipse Drain**: a dark sphere that drains the opponent's spin and gives it to Black Dranzer |
| **Driger** | **Twin Pounce**: two dashes in a row, and you can re-aim the second | **Thunder Claw**: three lunges. Tap in rhythm with the closing ring to land them perfectly |
| **Draciel** | **Iron Shell**: blocks most of the damage. Raise it right before a hit and it **parries**, sending the damage back | **Maelstrom**: Draciel anchors itself in a whirlpool that pulls the opponent in and slows it down |
| **Wolborg** | **Frost Howl**: a cone of cold that slows whatever it touches | **White Blizzard**: the whole stadium freezes. The opponent slides around, and one touch seals it in ice |
| **Zeus** | **Mirror Guard**: soaks up a hit, then fires it back with a dash | **Dark Dimension**: half of every hit on Zeus bounces back, and lightning strikes where the opponent stands |

All the effects (fire, wind, water, ice, darkness, lightning) are drawn live with shaders and particles. Every move has its own sound too, generated in the browser instead of loaded from audio files.

## 🏆 Modes

- **Tournament**: beat everyone in the bracket and take the title.
- **Quick Battle**: you against the CPU, best of 3.
- **Versus**: you against a friend, each on your own phone. One creates a room, the other types in the 4-letter code, and you're in. Versus is new and I'm still testing it on different networks, so if it doesn't connect for you, [let me know](#-feedback).

## 📸 Screenshots

<table>
  <tr>
    <th width="33%">Main menu</th>
    <th width="33%">Picking a bey</th>
    <th width="33%">In the arena</th>
  </tr>
  <tr>
    <td align="center"><img src="images/menu.jpeg" alt="Main menu" width="100%"></td>
    <td align="center"><img src="images/select.jpeg" alt="Picking a bey" width="100%"></td>
    <td align="center"><img src="images/fight.png" alt="A battle in the arena" width="100%"></td>
  </tr>
</table>

## 🎮 Controls

| | Phone / tablet | Computer |
|---|---|---|
| **Steer** | Tilt the phone (or use the joystick) | Drag the on-screen joystick |
| **Base move** | Base button | Base button |
| **Special move** | Special button, once it's charged | Special button, once it's charged |
| **Recalibrate tilt** | *Recalibrate* on the result screen | – |

A few tips:
- Go after your opponent. Whoever charges in does the damage.
- The base move goes where you were aiming when you pressed it, so line it up first.
- Landing base moves is the quickest way to get your special back.
- See a warning on the ground? Get out of there.
- Stay away from the wall, that's where the KO pockets are.
- If the screen flips upright mid-battle (it happens if you tilt too hard), the game pauses until you're back in landscape.

## 📱 On your phone

Open **[atymia.github.io/Bey-Arena](https://atymia.github.io/Bey-Arena/)** and turn the phone sideways. For the best experience add it to your home screen: it then opens fullscreen, like a normal app.

| iPhone (Safari) | Android (Chrome) |
|---|---|
| 1. Tap **Share** (the square with the arrow) | 1. Tap **⋮** in the top right |
| 2. Scroll down and tap **Add to Home Screen** | 2. Tap **Add to Home screen** (or **Install app**) |
| 3. Tap **Add** | 3. Confirm |

Good to know:
- You need an internet connection, the 3D engine loads online.
- On iPhone the game asks to use the motion sensors the first time. Tap **Allow** to steer by tilting.
- On iPhone, sounds are muted while the silent switch is on.
- Still seeing an old version after an update? Close the app completely and open it again. The version number is on the start screen.

## 💬 Feedback

Found a bug or have an idea? Open an [issue](https://github.com/Atymia/Bey-Arena/issues). It helps a lot if you tell me:
- the version on the start screen (e.g. `v47`),
- your phone or computer and browser (e.g. *iPhone 15, Safari*),
- what happened, and which beys were fighting.

## 🚀 What's next

- [x] Damage based on skill, not stats
- [x] New base and special moves with proper effects
- [x] A sound for every move
- [x] Versus mode (phone vs phone)
- [ ] Original names and artwork
- [ ] Real 3D models for each bey
- [ ] More beys
- [ ] Offline play
- [ ] Music

<details>
<summary><b>🛠️ How it's built</b></summary>

<br>

No build step and nothing to install: plain HTML and JavaScript, with Three.js loaded from a CDN. The game is hosted on GitHub Pages straight from this repository.

To try changes locally, any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight from disk mostly works, but the motion sensors and the home-screen install need a server (and HTTPS on a phone). After pushing an update, hit Ctrl+F5, because browsers love keeping old files around.

```
├── index.html      screens and buttons
├── style.css       look and layout, phone/landscape rules included
├── game.js         the game: physics, combat, moves, CPU, controls, 3D scene
├── fx.js           what the moves look like: shaders, particles, glow
├── sfx.js          what the moves sound like, made with the Web Audio API
├── net.js          Versus mode: rooms and keeping the two phones in sync
├── beys.js         the beys: stats, colors, move names and timings
├── hit.mp3         the clash sound
├── manifest.json   name, icon and orientation for the home-screen app
├── LICENSE         terms of use
└── images/         banner, screenshots and icons
```

Where to look if you're curious:
- stats, colors and moves of each bey → `beys.js`
- combat numbers (damage, knockback, parry window…) → top of `game.js`
- what each move does → `triggerBaseMove` and `stepSpecial` in `game.js`
- how each move looks → the `kit…` functions in `fx.js`
- how each move sounds → the `BASE`, `SPECIAL` and `EVENTS` tables in `sfx.js`
- stadium size, walls and KO pockets → `ARENA` and `buildStadium` in `game.js`

</details>

## 🙏 Credits

Made with [Three.js](https://threejs.org/) (r128). Versus mode uses [PeerJS](https://peerjs.com/) (MIT License). Fonts: [Inter](https://rsms.me/inter/), Bebas Neue and Roboto Mono from Google Fonts.

Lobo is an independent, non-commercial fan project. It isn't affiliated with or endorsed by the owners of Beyblade or any related toy or series, and all trademarks belong to their respective owners.

## 📄 License

© 2026 MrHide (Atymia). **All rights reserved.**

This project is not open source. You're welcome to play the game and read the code here, but please don't copy, reuse, republish or sell the code, graphics or sounds without asking first. Full terms in [LICENSE](LICENSE). Want to use something from the project? Just [open an issue](https://github.com/Atymia/Bey-Arena/issues) and ask.
