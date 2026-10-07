/* ============================================================
   VIDEO EDIT OUTLINES: ready-made structures for short and long videos
   ============================================================ */
// Each outline: [name, category, length, format, beats [[time, what]], tip].
var OUTLINES = [
  ['GRWM Loading %', 'Reels 2026', '15s', '9:16', [
    ['0–2s', '"getting ready: loading" counter starts at 0%'],
    ['2–12s', 'Each step a quick cut on the beat, the percent climbs, cuts escalate faster'],
    ['12–15s', '"100%" final look reveal on the drop']
  ], 'Make every cut a little shorter than the last so it feels like it’s loading faster.'],
  ['Age Hook: Things I Know at 27', 'Reels 2026', '30s', '9:16', [
    ['0–2s', '"things I know at 27"'],
    ['2–27s', 'One lesson per clip in big text, cut on every beat'],
    ['27–30s', '"save this for your next birthday"']
  ], 'Swap in your own age. Keep each lesson under eight words so it can be read in one beat.'],
  ['Velocity Edit', 'Reels 2026', '15s', '9:16', [
    ['0–3s', 'Slow build, speed ramps into the first drop'],
    ['3–12s', 'Fast cuts with zoom punches, shakes and glitch on every beat'],
    ['12–15s', 'Slow-motion final shot, hold']
  ], 'Ramp to slow motion right before each hit, then snap back to full speed on the beat.'],
  ['Reveal Transition Hook', 'Reels 2026', '10s', '9:16', [
    ['0–2s', '"wait for it…" over the before'],
    ['2–3s', 'Swipe reveal with a flash on the drop'],
    ['3–10s', 'The after: slow push-in, then quick cuts of the details']
  ], 'The reveal is the hook, so land it inside the first three seconds.'],
  ['YAP Video', 'Reels 2026', '45s', '9:16', [
    ['0–3s', '"unpopular opinion:" headline'],
    ['3–40s', 'Talking to camera, jump cuts on every pause, word-by-word captions'],
    ['40–45s', '"agree or disagree?"']
  ], 'Barely edited is the point. Just cut the pauses and keep big captions on screen.'],
  ['Routine Breakdown: Daily / Weekly / Monthly', 'Reels 2026', '30s', '9:16', [
    ['0–2s', '"my reset routine"'],
    ['2–12s', '"daily" quick cuts of the small habits'],
    ['12–22s', '"weekly" quick cuts of the bigger jobs'],
    ['22–30s', '"monthly" the deep reset, slow final shot']
  ], 'Use a different text color for each section so viewers know where they are.'],
  ['Process Reveal', 'Reels 2026', '20s', '9:16', [
    ['0–2s', 'Finished result first, then rewind'],
    ['2–17s', 'The process as quick cuts on the beat'],
    ['17–20s', '"it took 40 hours" final reveal']
  ], 'Showing the end first and then how you got there keeps people watching to the end.'],
  ['Photo Dump Velocity', 'Reels 2026', '12s', '9:16', [
    ['0–1s', '"photo dump"'],
    ['1–11s', 'One photo per beat with zoom punches and flashes'],
    ['11–12s', 'Best photo, hold']
  ], 'Add 10–20 photos in Your photos above. This one is made for them.'],
  ['Split-Screen Comparison', 'Reels 2026', '15s', '9:16', [
    ['0–2s', '"which one?"'],
    ['2–13s', 'Split screen, side by side, the wipe moves on the beat'],
    ['13–15s', '"comment A or B"']
  ], 'Asking people to pick in the comments brings in replies, which Instagram rewards.'],
  ['3-Second Hook Travel Reel', 'Travel', '15s', '9:16', [
    ['0–1s', 'Best shot first: the view, the jump, the reveal'],
    ['1–3s', 'Text: "POV: you finally booked it"'],
    ['3–10s', '8–10 quick clips cut on the beat, 0.5–1s each'],
    ['10–13s', 'Slow-motion hero moment'],
    ['13–15s', 'Location pin + "save this for later"']
  ], 'Cut every clip on a drum hit. Match colors with one LUT across all clips.'],
  ['Day in the Life Vlog', 'Vlog', '60s', '9:16', [
    ['0–3s', 'Morning shot + time stamp "6:30 AM"'],
    ['3–15s', 'Routine montage: coffee, outfit, commute'],
    ['15–40s', 'The main event of the day with voiceover'],
    ['40–55s', 'Wind-down: dinner, walk, golden hour'],
    ['55–60s', 'Closing thought to camera']
  ], 'Put time stamps in the same corner every time so they read as a series.'],
  ['City Guide: 5 Spots', 'Travel', '45s', '9:16', [
    ['0–3s', 'Fast montage of all 5 spots + "5 places in Lisbon you can’t skip"'],
    ['3–39s', 'Spot 1–5: name on screen, 2–3 clips each, price or tip'],
    ['39–45s', 'Map graphic with all pins + "follow for part 2"']
  ], 'Number each spot big on screen. Viewers stay to reach #5.'],
  ['Road Trip Montage', 'Travel', '90s', '16:9', [
    ['0–8s', 'Car door, engine start, map on the dash'],
    ['8–30s', 'Driving shots: window, dashcam, drone'],
    ['30–70s', 'Stops along the way, each cut to a music section'],
    ['70–85s', 'Sunset arrival'],
    ['85–90s', 'Title card with route and miles']
  ], 'Use J-cuts: let the next scene’s sound start before the picture.'],
  ['Hotel / Airbnb Tour', 'Travel', '30s', '9:16', [
    ['0–2s', 'Door opening POV'],
    ['2–20s', 'Room by room in a continuous walk, smooth whip transitions'],
    ['20–26s', 'Best feature: view, pool, bath'],
    ['26–30s', 'Price per night + location text']
  ], 'Shoot at 60fps so you can speed-ramp between rooms.'],

  ['Recipe in 30 Seconds', 'Food', '30s', '9:16', [
    ['0–2s', 'Finished dish, cheese pull or pour'],
    ['2–25s', 'Top-down steps, one clip per step, ingredient labels'],
    ['25–30s', 'First bite + "recipe in caption"']
  ], 'Overhead tripod, same framing all the way through. Speed up the slow steps 2–4×.'],
  ['Restaurant Review', 'Food', '45s', '9:16', [
    ['0–3s', 'Best-looking dish + score "9/10?"'],
    ['3–10s', 'Exterior and vibe shots'],
    ['10–35s', 'Each dish: close-up, bite, one-line verdict'],
    ['35–45s', 'Final score, price, address']
  ], 'Hold the score until the end and tease it at the start.'],
  ['ASMR Cooking', 'Food', '60s', '9:16', [
    ['0–5s', 'Sizzle close-up, no music'],
    ['5–50s', 'Chopping, pouring, frying with exaggerated natural sound'],
    ['50–60s', 'Plating in slow motion']
  ], 'No music, no voice. Boost the sound effects and use a macro lens.'],
  ['What I Eat in a Day', 'Food', '60s', '9:16', [
    ['0–3s', 'All meals laid out together'],
    ['3–50s', 'Breakfast, lunch, snack, dinner with calories or macros'],
    ['50–60s', 'Daily totals graphic']
  ], 'Keep a consistent label style, e.g. a white box with bold text.'],

  ['Workout Routine', 'Fitness', '30s', '9:16', [
    ['0–2s', 'Hardest move first + "try this burner"'],
    ['2–26s', '4–6 exercises, reps and sets on screen'],
    ['26–30s', 'Full routine summary card to screenshot']
  ], 'Film from the side so the form is clear. Loop the end back to the start.'],
  ['Transformation Before/After', 'Fitness', '20s', '9:16', [
    ['0–3s', 'Before photo + date'],
    ['3–15s', 'Fast montage of training clips with month counters'],
    ['15–20s', 'After reveal on the beat drop']
  ], 'Use the same pose, lighting and angle for the before and after shots.'],
  ['Form Check / Mistakes', 'Fitness', '30s', '9:16', [
    ['0–3s', 'Wrong form with a red ✕'],
    ['3–15s', 'Why it’s wrong, slowed down with arrows'],
    ['15–27s', 'Correct form with a green ✓'],
    ['27–30s', '"Save for leg day"']
  ], 'Split-screen right next to wrong is the clearest way to show the difference.'],

  ['Get Ready With Me (GRWM)', 'Fashion & Beauty', '60s', '9:16', [
    ['0–3s', 'Final look flash + "GRWM for…"'],
    ['3–45s', 'Steps with product names on screen'],
    ['45–55s', 'Outfit on, mirror shot'],
    ['55–60s', 'Walk out the door']
  ], 'Talk while you go; the story keeps people watching more than the makeup does.'],
  ['Outfit Transition', 'Fashion & Beauty', '15s', '9:16', [
    ['0–3s', 'Casual outfit, cover the lens or jump'],
    ['3–12s', '3–5 outfits, each switch cut on the beat'],
    ['12–15s', 'Best look, hold']
  ], 'Lock the camera on a tripod and match your position in every clip.'],
  ['Get the Look: Product Breakdown', 'Fashion & Beauty', '30s', '9:16', [
    ['0–2s', 'Full look'],
    ['2–25s', 'Each item: close-up, name, price'],
    ['25–30s', 'Total cost + "links in bio"']
  ], 'Use the same text style for every price so it reads like a catalogue.'],
  ['Skincare Routine', 'Fashion & Beauty', '45s', '9:16', [
    ['0–3s', 'Glowing skin close-up'],
    ['3–40s', 'Products in order, step numbers, texture shots'],
    ['40–45s', 'Product lineup']
  ], 'Use soft window light. Macro shots of textures do well.'],

  ['Product Unboxing', 'Product', '45s', '9:16', [
    ['0–2s', 'Box shot + "is it worth it?"'],
    ['2–15s', 'Opening, first look, what’s inside'],
    ['15–35s', 'Key features in use'],
    ['35–45s', 'Verdict + price']
  ], 'ASMR-style unboxing sound makes the opening satisfying.'],
  ['Product Ad (Problem → Solution)', 'Product', '30s', '9:16', [
    ['0–3s', 'The problem, exaggerated'],
    ['3–8s', '"There has to be a better way…"'],
    ['8–22s', 'Product solves it, 3 benefits on screen'],
    ['22–27s', 'Social proof: reviews, stars'],
    ['27–30s', 'Offer + call to action']
  ], 'Show the product within the first 5 seconds.'],
  ['Cinematic Product Spot', 'Product', '20s', '16:9', [
    ['0–5s', 'Dark frame, light sweeps across the product'],
    ['5–15s', 'Macro detail shots, slow sliders, rack focus'],
    ['15–20s', 'Hero shot + logo']
  ], 'Use a black background, one hard light and slow movement. Grade with lifted blacks.'],
  ['Comparison: A vs B', 'Product', '45s', '9:16', [
    ['0–3s', 'Both side by side + "which one wins?"'],
    ['3–38s', 'Round by round: design, speed, price, with a score per round'],
    ['38–45s', 'Winner reveal']
  ], 'Keep a running scoreboard on screen.'],

  ['Wedding Highlight Film', 'Events', '3–5 min', '16:9', [
    ['0:00–0:20', 'Vows audio over getting-ready shots'],
    ['0:20–1:30', 'Details, venue, first look'],
    ['1:30–3:00', 'Ceremony and speeches, best audio lines'],
    ['3:00–4:30', 'Party, dancing, sparkler exit'],
    ['4:30–5:00', 'Slow final kiss + names and date']
  ], 'Build the edit around the best spoken lines, then put the music under them.'],
  ['Wedding Teaser', 'Events', '60s', '9:16', [
    ['0–5s', 'Emotional line from the vows'],
    ['5–50s', 'Fast montage to an upbeat track'],
    ['50–60s', 'Couple walking away + names']
  ], 'Save the best kiss for the last beat.'],
  ['Birthday / Party Recap', 'Events', '30s', '9:16', [
    ['0–2s', 'Candles blown out'],
    ['2–25s', 'Guests, decor, dancing on the beat'],
    ['25–30s', 'Group photo freeze frame']
  ], 'End on a freeze frame with a white flash.'],
  ['Concert / Festival Recap', 'Events', '45s', '9:16', [
    ['0–3s', 'Crowd jumping on the drop'],
    ['3–40s', 'Stage, lights, friends, cut to the live audio'],
    ['40–45s', 'Wristband close-up + date']
  ], 'Use the artist’s actual live audio, not the studio track.'],

  ['Real Estate Listing Tour', 'Business', '60s', '16:9', [
    ['0–5s', 'Drone shot of the exterior'],
    ['5–45s', 'Gimbal walkthrough: entry, kitchen, living, bedrooms, bath'],
    ['45–55s', 'Best feature: view, yard, pool'],
    ['55–60s', 'Price, beds/baths, agent card']
  ], 'Use a wide lens, shoot at midday for interiors and golden hour for the exterior.'],
  ['Small Business Behind the Scenes', 'Business', '30s', '9:16', [
    ['0–2s', 'Finished product'],
    ['2–25s', 'How it’s made: hands, tools, process'],
    ['25–30s', 'Packing the order + "shop link in bio"']
  ], 'Viewers love seeing how things are made. Keep it raw and close-up.'],
  ['Customer Testimonial', 'Business', '60s', '16:9', [
    ['0–5s', 'Strongest quote first'],
    ['5–20s', 'Who they are, their problem'],
    ['20–45s', 'How the product helped, B-roll of them using it'],
    ['45–60s', 'Result + logo']
  ], 'Film the interview with two cameras so you can hide cuts.'],
  ['Brand Story', 'Business', '90s', '16:9', [
    ['0–10s', 'Founder’s voice: why we started'],
    ['10–40s', 'Early days, struggles, archive photos'],
    ['40–75s', 'Today: team, product, customers'],
    ['75–90s', 'Mission line + logo']
  ], 'Go from muted colors in the past to warm ones today.'],
  ['Hiring / Team Culture', 'Business', '45s', '9:16', [
    ['0–3s', '"Come work with us"'],
    ['3–35s', 'Team members, one line each about the job'],
    ['35–45s', 'Office or remote life + apply link']
  ], 'Real employees beat actors. Keep each person under 5 seconds.'],

  ['Quick Tutorial / How-To', 'Education', '45s', '9:16', [
    ['0–3s', 'End result + "how to do this in 3 steps"'],
    ['3–40s', 'Step 1, 2, 3 with numbered text'],
    ['40–45s', 'Result again + "save this"']
  ], 'Show the result first, then how to get there.'],
  ['Myth vs Fact', 'Education', '30s', '9:16', [
    ['0–3s', 'The myth in big text'],
    ['3–25s', 'Why it’s wrong, with visuals'],
    ['25–30s', 'The fact in one line']
  ], 'A red ✕ and a green ✓ make it easy to follow.'],
  ['Listicle: Top 5 Tips', 'Education', '60s', '9:16', [
    ['0–3s', '"5 tips I wish I knew sooner"'],
    ['3–55s', 'Tip 5 → 1, numbered, B-roll for each'],
    ['55–60s', 'The best tip saved for #1']
  ], 'Count down rather than up so people stay to the end.'],
  ['Explainer with Screen Recording', 'Education', '3 min', '16:9', [
    ['0:00–0:15', 'The problem and what you’ll learn'],
    ['0:15–2:30', 'Screen recording with zoom-ins and cursor highlights'],
    ['2:30–3:00', 'Recap + next video']
  ], 'Zoom in to 150–200% on whatever you click.'],

  ['Cinematic Short Film Opener', 'Cinematic', '60s', '2.39:1', [
    ['0–10s', 'Black screen, sound design only'],
    ['10–30s', 'Slow establishing shots, title appears'],
    ['30–50s', 'Character introduced in silhouette'],
    ['50–60s', 'Hard cut to title card']
  ], 'Add letterbox bars, a teal-and-orange LUT and film grain.'],
  ['Moody B-Roll Edit', 'Cinematic', '45s', '16:9', [
    ['0–5s', 'Out-of-focus lights coming into focus'],
    ['5–40s', 'Slow-motion details: hands, rain, steam, faces'],
    ['40–45s', 'Fade to black']
  ], 'Shoot at 120fps and conform to 24. Cut on motion.'],
  ['Music Video Performance Cut', 'Cinematic', '3 min', '16:9', [
    ['Intro', 'Wide establishing shot, artist alone'],
    ['Verse', 'Close-ups, lip sync, slow moves'],
    ['Chorus', 'Fast cuts, wide angles, lighting changes'],
    ['Bridge', 'Story moment or location change'],
    ['Final chorus', 'Every look intercut at full energy']
  ], 'Film the whole song from every angle, then pick the best moments.'],
  ['Drone Showcase', 'Cinematic', '60s', '16:9', [
    ['0–10s', 'High reveal over a ridge or building'],
    ['10–50s', 'Orbit, top-down, fly-through, low tracking shots'],
    ['50–60s', 'Pull-up and away']
  ], 'Use ND filters for natural motion blur, and change movement at every cut.'],

  ['Sports Highlight Reel', 'Sports', '60s', '16:9', [
    ['0–3s', 'Biggest play in slow motion'],
    ['3–50s', 'Best plays, hardest-hitting first, name and number tag'],
    ['50–60s', 'Stats card + contact']
  ], 'Circle or spotlight the player before each play starts.'],
  ['Game Day Hype', 'Sports', '30s', '9:16', [
    ['0–3s', 'Locker room, cleats lacing up'],
    ['3–20s', 'Warmups, crowd, speed ramps'],
    ['20–30s', 'Team run-out + score or date']
  ], 'Speed-ramp into slow motion on the bass hits.'],
  ['Skate / Trick Clip', 'Sports', '15s', '9:16', [
    ['0–3s', 'Approach'],
    ['3–8s', 'Trick in real time'],
    ['8–15s', 'Same trick slowed down from another angle']
  ], 'Use a fisheye for close follow shots.'],

  ['Trending Audio Lip Sync', 'Trends', '10s', '9:16', [
    ['0–10s', 'Act out the sound, with text adding your own twist']
  ], 'Use the sound within its first week of trending, and put your own spin on the joke.'],
  ['POV Skit', 'Trends', '30s', '9:16', [
    ['0–2s', '"POV: your boss sees you on a sick day"'],
    ['2–25s', 'Play both characters, switch sides for each one'],
    ['25–30s', 'Punchline + reaction']
  ], 'Change one prop or piece of clothing to show which character is talking.'],
  ['Photo Dump to Music', 'Trends', '15s', '9:16', [
    ['0–15s', '10–20 photos, one per beat, the best one held last']
  ], 'Edit the photos here first so they share one look, then cut them on the beat.'],
  ['Expectation vs Reality', 'Trends', '15s', '9:16', [
    ['0–7s', 'Expectation: polished, slow motion, warm grade'],
    ['7–15s', 'Reality: shaky, real, unflattering']
  ], 'The bigger the contrast, the funnier it is. Cut on a record scratch.'],
  ['Green Screen Reaction', 'Trends', '30s', '9:16', [
    ['0–30s', 'You over a screenshot or article, pointing and reacting']
  ], 'Keep yourself in the bottom third so the background stays readable.'],

  ['Podcast Clip', 'Podcast & Talk', '60s', '9:16', [
    ['0–3s', 'Most controversial line + bold captions'],
    ['3–55s', 'The story, cutting between speakers'],
    ['55–60s', 'Episode title + "full episode on…"']
  ], 'Burned-in word-by-word captions are a must. Most people watch muted.'],
  ['Interview Highlight', 'Podcast & Talk', '2 min', '16:9', [
    ['0:00–0:10', 'Best quote'],
    ['0:10–1:45', 'Three key answers with B-roll over them'],
    ['1:45–2:00', 'Final thought + lower-third name']
  ], 'Cut out filler words. Cover the jump cuts with B-roll.'],
  ['Storytime', 'Podcast & Talk', '90s', '9:16', [
    ['0–3s', '"So this is the craziest thing that’s ever happened to me"'],
    ['3–80s', 'Story to camera, jump cuts, zoom punch-ins on key moments'],
    ['80–90s', 'Twist or "part 2?"']
  ], 'Punch in 110–120% on emotional beats to keep the energy up.'],

  ['Year in Review', 'Personal', '60s', '16:9', [
    ['0–5s', '"2026" title over January’s first clip'],
    ['5–55s', 'Month by month, 4–5s each, month names on screen'],
    ['55–60s', 'Best moment + "here’s to next year"']
  ], 'Record 1 second every day all year and this edit almost makes itself.'],
  ['Pet Highlight', 'Personal', '20s', '9:16', [
    ['0–3s', 'Funniest moment'],
    ['3–17s', 'Zoomies, naps, tricks to an upbeat song'],
    ['17–20s', 'Close-up face + name']
  ], 'Film at pet eye level.'],
  ['Baby / Family Milestones', 'Personal', '60s', '16:9', [
    ['0–5s', 'Newborn photo'],
    ['5–55s', 'Month by month, same spot and same pose, with a counter'],
    ['55–60s', 'Today']
  ], 'Use the same chair, same light and same framing every month.'],
  ['Moving Into My New Place', 'Personal', '45s', '9:16', [
    ['0–3s', 'Empty room + keys'],
    ['3–35s', 'Unpacking, building furniture as a time-lapse'],
    ['35–45s', 'Finished room reveal, before/after wipe']
  ], 'Shoot the empty room and the finished room from the same spot for a clean wipe.'],

  ['YouTube Long-Form Intro', 'YouTube', '30–60s', '16:9', [
    ['0–5s', 'Payoff tease: show the end result'],
    ['5–20s', 'Why it matters + what’s at stake'],
    ['20–30s', 'Fast montage of what’s coming'],
    ['30s', 'Short logo sting, then straight into the content']
  ], 'Skip the "hey guys, welcome back". Start with the most interesting thing.'],
  ['Challenge Video', 'YouTube', '10–15 min', '16:9', [
    ['0:00–0:30', 'The challenge + stakes'],
    ['0:30–3:00', 'Setup, rules, first attempt'],
    ['3:00–10:00', 'Rising difficulty with a fail in the middle'],
    ['10:00–13:00', 'Final attempt'],
    ['13:00–15:00', 'Result + reaction']
  ], 'Put a re-hook every 2–3 minutes: "but then things went wrong…"'],
  ['Shorts Repurpose', 'YouTube', '45s', '9:16', [
    ['0–2s', 'Most surprising moment from the long video'],
    ['2–40s', 'One idea only, reframed to vertical'],
    ['40–45s', '"Full video on my channel"']
  ], 'Reframe each shot by hand. Auto-crop cuts off faces.']
];

var olCat = 'All',
  olOpen = {};

function olText(o) {
  return o[0] + ' (' + o[2] + ', ' + o[3] + ')\n' + o[4].map(function(b) {
    return b[0] + ': ' + b[1]
  }).join('\n') + '\nTip: ' + o[5]
}

function renderOutlines() {
  var cats = ['All'].concat(OUTLINES.map(function(o) {
      return o[1]
    }).filter(function(c, i, a) {
      return a.indexOf(c) === i
    })),
    q = $('#olQ').value.trim().toLowerCase(),
    list = OUTLINES.filter(function(o) {
      return (olCat === 'All' || o[1] === olCat) && (!q || olText(o).toLowerCase().indexOf(q) >= 0 || o[1].toLowerCase().indexOf(q) >= 0)
    });
  $('#olCats').innerHTML = cats.map(function(c) {
    return '<button data-c="' + esc(c) + '" class="' + (c === olCat ? 'on' : '') + '">' + esc(c) + '</button>'
  }).join('');
  $$('#olCats button').forEach(function(b) {
    b.onclick = function() {
      olCat = b.dataset.c;
      renderOutlines()
    }
  });
  $('#olN').textContent = list.length + ' of ' + OUTLINES.length + ' outlines';
  $('#olList').innerHTML = list.length ? list.map(function(o) {
    var i = OUTLINES.indexOf(o),
      open = olOpen[i];
    return '<div class="ol' + (open ? ' on' : '') + '" data-i="' + i + '"><button class="olh"><b>' + esc(o[0]) + '</b><span><i>' + esc(o[1]) + '</i> · ' + esc(o[2]) + ' · ' + esc(o[3]) + '</span></button>' + (open ? '<ol class="olb">' + o[4].map(function(b) {
      return '<li><em>' + esc(b[0]) + '</em>' + esc(b[1]) + '</li>'
    }).join('') + '</ol><p class="olt"><b>Tip</b> ' + esc(o[5]) + '</p><div class="olact"><button class="btn pri olp">&#9654; Play example</button><button class="btn olu">Use template</button><button class="btn ghost olc">Copy</button></div><div class="olx">Real examples: <a href="' + olSearch(o, 'yt') + '" target="_blank" rel="noopener">YouTube</a> &middot; <a href="' + olSearch(o, 'tt') + '" target="_blank" rel="noopener">TikTok</a></div>' : '') + '</div>'
  }).join('') : '<div class="empty">No outlines match “' + esc(q) + '”.</div>';
  $$('#olList .ol').forEach(function(el) {
    var i = +el.dataset.i;
    el.querySelector('.olh').onclick = function() {
      olOpen[i] = !olOpen[i];
      renderOutlines()
    };
    var us = el.querySelector('.olu');
    if (us) us.onclick = function() {
      reUseTemplate(i)
    };
    var pv = el.querySelector('.olp');
    if (pv) pv.onclick = function() {
      openVid(i)
    };
    var c = el.querySelector('.olc');
    if (c) c.onclick = function() {
      var t = olText(OUTLINES[i]);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function() {
        toast('Outline copied')
      }, function() {
        toast('Couldn’t copy. Select the text instead')
      })
    }
  })
}

$('#olQ').oninput = renderOutlines;
renderOutlines();

function olSearch(o, site) {
  var q = encodeURIComponent(o[0].replace(/[()]/g, '') + ' ' + (o[3] === '9:16' ? 'reel edit' : 'video edit'));
  return site === 'yt' ? 'https://www.youtube.com/results?search_query=' + q : 'https://www.tiktok.com/search?q=' + q
}
