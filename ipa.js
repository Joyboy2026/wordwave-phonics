/* WORDWAVE 音标室
 * 48 个常用英语音标：20 个元音 + 28 个辅音。
 * 每个音标配一个例词（音频在 audio/ipa/<id>.mp3）。
 */
window.IPA_DATA = {
  meta: {
    total: 48,
    vowels: 20,
    consonants: 28,
    note: "英式音标，例词读音为 en-GB"
  },
  phonemes: [
    /* ---------- 元音 · 短元音 ---------- */
    {
      id: "i-short", sym: "/ɪ/", group: "vowel", section: "短元音",
      word: "sit", highlight: "i", cn: "坐", spell: "i, y",
      voiced: true, tip: "短促轻快，舌前部稍抬，嘴角放松。"
    },
    {
      id: "e", sym: "/e/", group: "vowel", section: "短元音",
      word: "bed", highlight: "e", cn: "床", spell: "e, ea",
      voiced: true, tip: "嘴半开，舌尖抵下齿，舌前部稍抬。"
    },
    {
      id: "ae", sym: "/æ/", group: "vowel", section: "短元音",
      word: "cat", highlight: "a", cn: "猫", spell: "a",
      voiced: true, tip: "嘴张大，舌尖抵下齿，舌前部压低。"
    },
    {
      id: "uh", sym: "/ʌ/", group: "vowel", section: "短元音",
      word: "bus", highlight: "u", cn: "公共汽车", spell: "u, o",
      voiced: true, tip: "嘴半开，舌中部抬起，声音短促。"
    },
    {
      id: "o-short", sym: "/ɒ/", group: "vowel", section: "短元音",
      word: "dog", highlight: "o", cn: "狗", spell: "o, a",
      voiced: true, tip: "嘴唇略圆，舌后部抬起，声音短促。"
    },
    {
      id: "u-short", sym: "/ʊ/", group: "vowel", section: "短元音",
      word: "book", highlight: "oo", cn: "书", spell: "oo, u",
      voiced: true, tip: "嘴唇微圆，舌后部抬起，声音短促。"
    },
    {
      id: "schwa", sym: "/ə/", group: "vowel", section: "短元音",
      word: "about", highlight: "a", cn: "关于", spell: "a, er, or",
      voiced: true, tip: "嘴唇放松，舌中部自然，轻而短。"
    },

    /* ---------- 元音 · 长元音 ---------- */
    {
      id: "i-long", sym: "/iː/", group: "vowel", section: "长元音",
      word: "see", highlight: "ee", cn: "看见", spell: "ee, ea, e",
      voiced: true, tip: "嘴角向两边拉开，舌前部抬高，声音拉长。"
    },
    {
      id: "er-long", sym: "/ɜː/", group: "vowel", section: "长元音",
      word: "bird", highlight: "ir", cn: "鸟", spell: "ir, er, ur",
      voiced: true, tip: "嘴半开，舌中部抬起，声音拉长。"
    },
    {
      id: "a-long", sym: "/ɑː/", group: "vowel", section: "长元音",
      word: "car", highlight: "ar", cn: "汽车", spell: "ar, a",
      voiced: true, tip: "嘴张大，舌后部压低，声音拉长。"
    },
    {
      id: "o-long", sym: "/ɔː/", group: "vowel", section: "长元音",
      word: "door", highlight: "oor", cn: "门", spell: "oor, or, aw",
      voiced: true, tip: "嘴唇收圆，舌后部抬起，声音拉长。"
    },
    {
      id: "u-long", sym: "/uː/", group: "vowel", section: "长元音",
      word: "moon", highlight: "oo", cn: "月亮", spell: "oo, ue, u",
      voiced: true, tip: "嘴唇收圆前突，舌后部抬高，声音拉长。"
    },

    /* ---------- 元音 · 双元音 ---------- */
    {
      id: "ei", sym: "/eɪ/", group: "vowel", section: "双元音",
      word: "day", highlight: "ay", cn: "白天", spell: "ay, ai, a_e",
      voiced: true, tip: "从 /e/ 滑向 /ɪ/，前重后轻。"
    },
    {
      id: "ai", sym: "/aɪ/", group: "vowel", section: "双元音",
      word: "bike", highlight: "i", cn: "自行车", spell: "i, igh, y",
      voiced: true, tip: "从 /a/ 滑向 /ɪ/，前重后轻。"
    },
    {
      id: "oi", sym: "/ɔɪ/", group: "vowel", section: "双元音",
      word: "boy", highlight: "oy", cn: "男孩", spell: "oy, oi",
      voiced: true, tip: "从 /ɔ/ 滑向 /ɪ/，前重后轻。"
    },
    {
      id: "au", sym: "/aʊ/", group: "vowel", section: "双元音",
      word: "house", highlight: "ou", cn: "房子", spell: "ou, ow",
      voiced: true, tip: "从 /a/ 滑向 /ʊ/，前重后轻。"
    },
    {
      id: "ou", sym: "/əʊ/", group: "vowel", section: "双元音",
      word: "home", highlight: "o", cn: "家", spell: "o, oa, ow",
      voiced: true, tip: "从 /ə/ 滑向 /ʊ/，前重后轻。"
    },
    {
      id: "ie", sym: "/ɪə/", group: "vowel", section: "双元音",
      word: "ear", highlight: "ear", cn: "耳朵", spell: "ear, eer, ere",
      voiced: true, tip: "从 /ɪ/ 滑向 /ə/，前重后轻。"
    },
    {
      id: "ea", sym: "/eə/", group: "vowel", section: "双元音",
      word: "hair", highlight: "air", cn: "头发", spell: "air, ear, are",
      voiced: true, tip: "从 /e/ 滑向 /ə/，前重后轻。"
    },
    {
      id: "ue", sym: "/ʊə/", group: "vowel", section: "双元音",
      word: "tour", highlight: "our", cn: "旅行", spell: "our, ure",
      voiced: true, tip: "从 /ʊ/ 滑向 /ə/，前重后轻。"
    },

    /* ---------- 辅音 · 爆破音 ---------- */
    {
      id: "p", sym: "/p/", group: "consonant", section: "爆破音",
      word: "pen", highlight: "p", cn: "钢笔", spell: "p",
      voiced: false, tip: "双唇紧闭，突然放开，不振动声带。"
    },
    {
      id: "b", sym: "/b/", group: "consonant", section: "爆破音",
      word: "bag", highlight: "b", cn: "包", spell: "b",
      voiced: true, tip: "双唇紧闭，突然放开，振动声带。"
    },
    {
      id: "t", sym: "/t/", group: "consonant", section: "爆破音",
      word: "ten", highlight: "t", cn: "十", spell: "t",
      voiced: false, tip: "舌尖抵上齿龈，突然放开，不振动声带。"
    },
    {
      id: "d", sym: "/d/", group: "consonant", section: "爆破音",
      word: "dog", highlight: "d", cn: "狗", spell: "d",
      voiced: true, tip: "舌尖抵上齿龈，突然放开，振动声带。"
    },
    {
      id: "k", sym: "/k/", group: "consonant", section: "爆破音",
      word: "cat", highlight: "c", cn: "猫", spell: "c, k, ck",
      voiced: false, tip: "舌根抵软腭，突然放开，不振动声带。"
    },
    {
      id: "g", sym: "/g/", group: "consonant", section: "爆破音",
      word: "good", highlight: "g", cn: "好的", spell: "g",
      voiced: true, tip: "舌根抵软腭，突然放开，振动声带。"
    },

    /* ---------- 辅音 · 摩擦音 ---------- */
    {
      id: "f", sym: "/f/", group: "consonant", section: "摩擦音",
      word: "fish", highlight: "f", cn: "鱼", spell: "f, ph",
      voiced: false, tip: "上齿轻触下唇，气流从缝隙挤出，不振动声带。"
    },
    {
      id: "v", sym: "/v/", group: "consonant", section: "摩擦音",
      word: "very", highlight: "v", cn: "非常", spell: "v",
      voiced: true, tip: "上齿轻触下唇，气流从缝隙挤出，振动声带。"
    },
    {
      id: "th-voiceless", sym: "/θ/", group: "consonant", section: "摩擦音",
      word: "think", highlight: "th", cn: "想", spell: "th",
      voiced: false, tip: "舌尖轻放上下齿间，气流挤出，不振动声带。"
    },
    {
      id: "th-voiced", sym: "/ð/", group: "consonant", section: "摩擦音",
      word: "this", highlight: "th", cn: "这个", spell: "th",
      voiced: true, tip: "舌尖轻放上下齿间，气流挤出，振动声带。"
    },
    {
      id: "s", sym: "/s/", group: "consonant", section: "摩擦音",
      word: "sun", highlight: "s", cn: "太阳", spell: "s, c",
      voiced: false, tip: "舌尖靠近上齿龈，气流从缝隙挤出，不振动声带。"
    },
    {
      id: "z", sym: "/z/", group: "consonant", section: "摩擦音",
      word: "zoo", highlight: "z", cn: "动物园", spell: "z, s",
      voiced: true, tip: "舌尖靠近上齿龈，气流从缝隙挤出，振动声带。"
    },
    {
      id: "sh", sym: "/ʃ/", group: "consonant", section: "摩擦音",
      word: "ship", highlight: "sh", cn: "船", spell: "sh, ti, ci",
      voiced: false, tip: "舌端靠近齿龈后部，嘴唇略圆，不振动声带。"
    },
    {
      id: "zh", sym: "/ʒ/", group: "consonant", section: "摩擦音",
      word: "television", highlight: "s", cn: "电视", spell: "s, ge",
      voiced: true, tip: "舌端靠近齿龈后部，嘴唇略圆，振动声带。"
    },
    {
      id: "h", sym: "/h/", group: "consonant", section: "摩擦音",
      word: "hat", highlight: "h", cn: "帽子", spell: "h",
      voiced: false, tip: "气流从喉咙轻轻呼出，不振动声带。"
    },

    /* ---------- 辅音 · 破擦音 ---------- */
    {
      id: "ch", sym: "/tʃ/", group: "consonant", section: "破擦音",
      word: "chair", highlight: "ch", cn: "椅子", spell: "ch, tch",
      voiced: false, tip: "舌端抵齿龈后部，先阻塞再摩擦，不振动声带。"
    },
    {
      id: "j", sym: "/dʒ/", group: "consonant", section: "破擦音",
      word: "jump", highlight: "j", cn: "跳", spell: "j, g, dge",
      voiced: true, tip: "舌端抵齿龈后部，先阻塞再摩擦，振动声带。"
    },
    {
      id: "tr", sym: "/tr/", group: "consonant", section: "破擦音",
      word: "tree", highlight: "tr", cn: "树", spell: "tr",
      voiced: false, tip: "舌尖抵齿龈后部，先阻塞再摩擦，不振动声带。"
    },
    {
      id: "dr", sym: "/dr/", group: "consonant", section: "破擦音",
      word: "dress", highlight: "dr", cn: "连衣裙", spell: "dr",
      voiced: true, tip: "舌尖抵齿龈后部，先阻塞再摩擦，振动声带。"
    },
    {
      id: "ts", sym: "/ts/", group: "consonant", section: "破擦音",
      word: "cats", highlight: "ts", cn: "猫（复数）", spell: "ts, tes",
      voiced: false, tip: "舌尖抵齿龈，先阻塞再摩擦，不振动声带。"
    },
    {
      id: "dz", sym: "/dz/", group: "consonant", section: "破擦音",
      word: "beds", highlight: "ds", cn: "床（复数）", spell: "ds, des",
      voiced: true, tip: "舌尖抵齿龈，先阻塞再摩擦，振动声带。"
    },

    /* ---------- 辅音 · 鼻音 ---------- */
    {
      id: "m", sym: "/m/", group: "consonant", section: "鼻音",
      word: "man", highlight: "m", cn: "男人", spell: "m",
      voiced: true, tip: "双唇紧闭，气流从鼻腔出，振动声带。"
    },
    {
      id: "n", sym: "/n/", group: "consonant", section: "鼻音",
      word: "nose", highlight: "n", cn: "鼻子", spell: "n",
      voiced: true, tip: "舌尖抵上齿龈，气流从鼻腔出，振动声带。"
    },
    {
      id: "ng", sym: "/ŋ/", group: "consonant", section: "鼻音",
      word: "sing", highlight: "ng", cn: "唱歌", spell: "ng, n",
      voiced: true, tip: "舌根抵软腭，气流从鼻腔出，振动声带。"
    },

    /* ---------- 辅音 · 舌侧音 ---------- */
    {
      id: "l", sym: "/l/", group: "consonant", section: "舌侧音",
      word: "lion", highlight: "l", cn: "狮子", spell: "l",
      voiced: true, tip: "舌尖抵上齿龈，气流从舌两侧出，振动声带。"
    },

    /* ---------- 辅音 · 半元音 ---------- */
    {
      id: "r", sym: "/r/", group: "consonant", section: "半元音",
      word: "red", highlight: "r", cn: "红色", spell: "r",
      voiced: true, tip: "舌尖卷起但不碰上腭，嘴唇略圆，振动声带。"
    },
    {
      id: "y", sym: "/j/", group: "consonant", section: "半元音",
      word: "yes", highlight: "y", cn: "是的", spell: "y",
      voiced: true, tip: "舌前部抬向硬腭，很快滑向元音，振动声带。"
    },
    {
      id: "w", sym: "/w/", group: "consonant", section: "半元音",
      word: "water", highlight: "w", cn: "水", spell: "w, wh",
      voiced: true, tip: "双唇收圆前突，很快滑向元音，振动声带。"
    }
  ]
};
