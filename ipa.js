/* WORDWAVE 音标室
 * 48 个常用英语音标：20 个元音 + 28 个辅音。
 * 每个音标 5 个例词；首个例词的音频在 audio/ipa/<id>.mp3，
 * 其余例词的音频在 audio/ipa/words/<slug>.mp3。
 */
window.IPA_DATA = {
  "meta": {
    "total": 48,
    "vowels": 20,
    "consonants": 28,
    "note": "英式音标，例词读音为 en-GB"
  },
  "phonemes": [
    {
      "id": "i-short",
      "sym": "/ɪ/",
      "group": "vowel",
      "section": "短元音",
      "word": "sit",
      "highlight": "i",
      "cn": "坐",
      "spell": "i, y",
      "voiced": true,
      "tip": "短促轻快，舌前部稍抬，嘴角放松。",
      "words": [
        {
          "w": "sit",
          "hl": "i",
          "cn": "坐"
        },
        {
          "w": "big",
          "hl": "i",
          "cn": "大的"
        },
        {
          "w": "fish",
          "hl": "i",
          "cn": "鱼"
        },
        {
          "w": "milk",
          "hl": "i",
          "cn": "牛奶"
        },
        {
          "w": "six",
          "hl": "i",
          "cn": "六"
        }
      ]
    },
    {
      "id": "e",
      "sym": "/e/",
      "group": "vowel",
      "section": "短元音",
      "word": "bed",
      "highlight": "e",
      "cn": "床",
      "spell": "e, ea",
      "voiced": true,
      "tip": "嘴半开，舌尖抵下齿，舌前部稍抬。",
      "words": [
        {
          "w": "bed",
          "hl": "e",
          "cn": "床"
        },
        {
          "w": "pen",
          "hl": "e",
          "cn": "钢笔"
        },
        {
          "w": "red",
          "hl": "e",
          "cn": "红色的"
        },
        {
          "w": "ten",
          "hl": "e",
          "cn": "十"
        },
        {
          "w": "egg",
          "hl": "e",
          "cn": "鸡蛋"
        }
      ]
    },
    {
      "id": "ae",
      "sym": "/æ/",
      "group": "vowel",
      "section": "短元音",
      "word": "cat",
      "highlight": "a",
      "cn": "猫",
      "spell": "a",
      "voiced": true,
      "tip": "嘴张大，舌尖抵下齿，舌前部压低。",
      "words": [
        {
          "w": "cat",
          "hl": "a",
          "cn": "猫"
        },
        {
          "w": "bag",
          "hl": "a",
          "cn": "包"
        },
        {
          "w": "hat",
          "hl": "a",
          "cn": "帽子"
        },
        {
          "w": "map",
          "hl": "a",
          "cn": "地图"
        },
        {
          "w": "sad",
          "hl": "a",
          "cn": "难过的"
        }
      ]
    },
    {
      "id": "uh",
      "sym": "/ʌ/",
      "group": "vowel",
      "section": "短元音",
      "word": "bus",
      "highlight": "u",
      "cn": "公共汽车",
      "spell": "u, o",
      "voiced": true,
      "tip": "嘴半开，舌中部抬起，声音短促。",
      "words": [
        {
          "w": "bus",
          "hl": "u",
          "cn": "公共汽车"
        },
        {
          "w": "cup",
          "hl": "u",
          "cn": "杯子"
        },
        {
          "w": "sun",
          "hl": "u",
          "cn": "太阳"
        },
        {
          "w": "run",
          "hl": "u",
          "cn": "跑"
        },
        {
          "w": "love",
          "hl": "o",
          "cn": "爱"
        }
      ]
    },
    {
      "id": "o-short",
      "sym": "/ɒ/",
      "group": "vowel",
      "section": "短元音",
      "word": "dog",
      "highlight": "o",
      "cn": "狗",
      "spell": "o, a",
      "voiced": true,
      "tip": "嘴唇略圆，舌后部抬起，声音短促。",
      "words": [
        {
          "w": "dog",
          "hl": "o",
          "cn": "狗"
        },
        {
          "w": "box",
          "hl": "o",
          "cn": "盒子"
        },
        {
          "w": "hot",
          "hl": "o",
          "cn": "热的"
        },
        {
          "w": "clock",
          "hl": "o",
          "cn": "钟"
        },
        {
          "w": "lot",
          "hl": "o",
          "cn": "许多"
        }
      ]
    },
    {
      "id": "u-short",
      "sym": "/ʊ/",
      "group": "vowel",
      "section": "短元音",
      "word": "book",
      "highlight": "oo",
      "cn": "书",
      "spell": "oo, u",
      "voiced": true,
      "tip": "嘴唇微圆，舌后部抬起，声音短促。",
      "words": [
        {
          "w": "book",
          "hl": "oo",
          "cn": "书"
        },
        {
          "w": "look",
          "hl": "oo",
          "cn": "看"
        },
        {
          "w": "good",
          "hl": "oo",
          "cn": "好的"
        },
        {
          "w": "foot",
          "hl": "oo",
          "cn": "脚"
        },
        {
          "w": "put",
          "hl": "u",
          "cn": "放"
        }
      ]
    },
    {
      "id": "schwa",
      "sym": "/ə/",
      "group": "vowel",
      "section": "短元音",
      "word": "about",
      "highlight": "a",
      "cn": "关于",
      "spell": "a, er, or",
      "voiced": true,
      "tip": "嘴唇放松，舌中部自然，轻而短。",
      "words": [
        {
          "w": "about",
          "hl": "a",
          "cn": "关于"
        },
        {
          "w": "teacher",
          "hl": "er",
          "cn": "老师"
        },
        {
          "w": "banana",
          "hl": "a",
          "cn": "香蕉"
        },
        {
          "w": "sofa",
          "hl": "a",
          "cn": "沙发"
        },
        {
          "w": "support",
          "hl": "u",
          "cn": "支持"
        }
      ]
    },
    {
      "id": "i-long",
      "sym": "/iː/",
      "group": "vowel",
      "section": "长元音",
      "word": "see",
      "highlight": "ee",
      "cn": "看见",
      "spell": "ee, ea, e",
      "voiced": true,
      "tip": "嘴角向两边拉开，舌前部抬高，声音拉长。",
      "words": [
        {
          "w": "see",
          "hl": "ee",
          "cn": "看见"
        },
        {
          "w": "tree",
          "hl": "ee",
          "cn": "树"
        },
        {
          "w": "meat",
          "hl": "ea",
          "cn": "肉"
        },
        {
          "w": "key",
          "hl": "ey",
          "cn": "钥匙"
        },
        {
          "w": "green",
          "hl": "ee",
          "cn": "绿色的"
        }
      ]
    },
    {
      "id": "er-long",
      "sym": "/ɜː/",
      "group": "vowel",
      "section": "长元音",
      "word": "bird",
      "highlight": "ir",
      "cn": "鸟",
      "spell": "ir, er, ur",
      "voiced": true,
      "tip": "嘴半开，舌中部抬起，声音拉长。",
      "words": [
        {
          "w": "bird",
          "hl": "ir",
          "cn": "鸟"
        },
        {
          "w": "girl",
          "hl": "ir",
          "cn": "女孩"
        },
        {
          "w": "nurse",
          "hl": "ur",
          "cn": "护士"
        },
        {
          "w": "work",
          "hl": "or",
          "cn": "工作"
        },
        {
          "w": "learn",
          "hl": "ear",
          "cn": "学习"
        }
      ]
    },
    {
      "id": "a-long",
      "sym": "/ɑː/",
      "group": "vowel",
      "section": "长元音",
      "word": "car",
      "highlight": "ar",
      "cn": "汽车",
      "spell": "ar, a",
      "voiced": true,
      "tip": "嘴张大，舌后部压低，声音拉长。",
      "words": [
        {
          "w": "car",
          "hl": "ar",
          "cn": "汽车"
        },
        {
          "w": "star",
          "hl": "ar",
          "cn": "星星"
        },
        {
          "w": "farm",
          "hl": "ar",
          "cn": "农场"
        },
        {
          "w": "park",
          "hl": "ar",
          "cn": "公园"
        },
        {
          "w": "father",
          "hl": "a",
          "cn": "父亲"
        }
      ]
    },
    {
      "id": "o-long",
      "sym": "/ɔː/",
      "group": "vowel",
      "section": "长元音",
      "word": "door",
      "highlight": "oor",
      "cn": "门",
      "spell": "oor, or, aw",
      "voiced": true,
      "tip": "嘴唇收圆，舌后部抬起，声音拉长。",
      "words": [
        {
          "w": "door",
          "hl": "oor",
          "cn": "门"
        },
        {
          "w": "four",
          "hl": "our",
          "cn": "四"
        },
        {
          "w": "ball",
          "hl": "al",
          "cn": "球"
        },
        {
          "w": "horse",
          "hl": "or",
          "cn": "马"
        },
        {
          "w": "talk",
          "hl": "al",
          "cn": "说话"
        }
      ]
    },
    {
      "id": "u-long",
      "sym": "/uː/",
      "group": "vowel",
      "section": "长元音",
      "word": "moon",
      "highlight": "oo",
      "cn": "月亮",
      "spell": "oo, ue, u",
      "voiced": true,
      "tip": "嘴唇收圆前突，舌后部抬高，声音拉长。",
      "words": [
        {
          "w": "moon",
          "hl": "oo",
          "cn": "月亮"
        },
        {
          "w": "food",
          "hl": "oo",
          "cn": "食物"
        },
        {
          "w": "blue",
          "hl": "ue",
          "cn": "蓝色"
        },
        {
          "w": "school",
          "hl": "oo",
          "cn": "学校"
        },
        {
          "w": "June",
          "hl": "u",
          "cn": "六月"
        }
      ]
    },
    {
      "id": "ei",
      "sym": "/eɪ/",
      "group": "vowel",
      "section": "双元音",
      "word": "day",
      "highlight": "ay",
      "cn": "白天",
      "spell": "ay, ai, a_e",
      "voiced": true,
      "tip": "从 /e/ 滑向 /ɪ/，前重后轻。",
      "words": [
        {
          "w": "day",
          "hl": "ay",
          "cn": "白天"
        },
        {
          "w": "name",
          "hl": "a",
          "cn": "名字"
        },
        {
          "w": "cake",
          "hl": "a",
          "cn": "蛋糕"
        },
        {
          "w": "play",
          "hl": "ay",
          "cn": "玩"
        },
        {
          "w": "eight",
          "hl": "eigh",
          "cn": "八"
        }
      ]
    },
    {
      "id": "ai",
      "sym": "/aɪ/",
      "group": "vowel",
      "section": "双元音",
      "word": "bike",
      "highlight": "i",
      "cn": "自行车",
      "spell": "i, igh, y",
      "voiced": true,
      "tip": "从 /a/ 滑向 /ɪ/，前重后轻。",
      "words": [
        {
          "w": "bike",
          "hl": "i",
          "cn": "自行车"
        },
        {
          "w": "time",
          "hl": "i",
          "cn": "时间"
        },
        {
          "w": "my",
          "hl": "y",
          "cn": "我的"
        },
        {
          "w": "light",
          "hl": "igh",
          "cn": "光"
        },
        {
          "w": "fly",
          "hl": "y",
          "cn": "飞"
        }
      ]
    },
    {
      "id": "oi",
      "sym": "/ɔɪ/",
      "group": "vowel",
      "section": "双元音",
      "word": "boy",
      "highlight": "oy",
      "cn": "男孩",
      "spell": "oy, oi",
      "voiced": true,
      "tip": "从 /ɔ/ 滑向 /ɪ/，前重后轻。",
      "words": [
        {
          "w": "boy",
          "hl": "oy",
          "cn": "男孩"
        },
        {
          "w": "toy",
          "hl": "oy",
          "cn": "玩具"
        },
        {
          "w": "coin",
          "hl": "oi",
          "cn": "硬币"
        },
        {
          "w": "noise",
          "hl": "oi",
          "cn": "噪音"
        },
        {
          "w": "enjoy",
          "hl": "oy",
          "cn": "享受"
        }
      ]
    },
    {
      "id": "au",
      "sym": "/aʊ/",
      "group": "vowel",
      "section": "双元音",
      "word": "house",
      "highlight": "ou",
      "cn": "房子",
      "spell": "ou, ow",
      "voiced": true,
      "tip": "从 /a/ 滑向 /ʊ/，前重后轻。",
      "words": [
        {
          "w": "house",
          "hl": "ou",
          "cn": "房子"
        },
        {
          "w": "mouse",
          "hl": "ou",
          "cn": "老鼠"
        },
        {
          "w": "cow",
          "hl": "ow",
          "cn": "奶牛"
        },
        {
          "w": "town",
          "hl": "ow",
          "cn": "城镇"
        },
        {
          "w": "out",
          "hl": "ou",
          "cn": "外面"
        }
      ]
    },
    {
      "id": "ou",
      "sym": "/əʊ/",
      "group": "vowel",
      "section": "双元音",
      "word": "home",
      "highlight": "o",
      "cn": "家",
      "spell": "o, oa, ow",
      "voiced": true,
      "tip": "从 /ə/ 滑向 /ʊ/，前重后轻。",
      "words": [
        {
          "w": "home",
          "hl": "o",
          "cn": "家"
        },
        {
          "w": "go",
          "hl": "o",
          "cn": "去"
        },
        {
          "w": "nose",
          "hl": "o",
          "cn": "鼻子"
        },
        {
          "w": "boat",
          "hl": "oa",
          "cn": "船"
        },
        {
          "w": "snow",
          "hl": "ow",
          "cn": "雪"
        }
      ]
    },
    {
      "id": "ie",
      "sym": "/ɪə/",
      "group": "vowel",
      "section": "双元音",
      "word": "ear",
      "highlight": "ear",
      "cn": "耳朵",
      "spell": "ear, eer, ere",
      "voiced": true,
      "tip": "从 /ɪ/ 滑向 /ə/，前重后轻。",
      "words": [
        {
          "w": "ear",
          "hl": "ear",
          "cn": "耳朵"
        },
        {
          "w": "near",
          "hl": "ear",
          "cn": "附近"
        },
        {
          "w": "here",
          "hl": "ere",
          "cn": "这里"
        },
        {
          "w": "fear",
          "hl": "ear",
          "cn": "害怕"
        },
        {
          "w": "idea",
          "hl": "ea",
          "cn": "主意"
        }
      ]
    },
    {
      "id": "ea",
      "sym": "/eə/",
      "group": "vowel",
      "section": "双元音",
      "word": "hair",
      "highlight": "air",
      "cn": "头发",
      "spell": "air, ear, are",
      "voiced": true,
      "tip": "从 /e/ 滑向 /ə/，前重后轻。",
      "words": [
        {
          "w": "hair",
          "hl": "air",
          "cn": "头发"
        },
        {
          "w": "chair",
          "hl": "air",
          "cn": "椅子"
        },
        {
          "w": "bear",
          "hl": "ear",
          "cn": "熊"
        },
        {
          "w": "care",
          "hl": "are",
          "cn": "关心"
        },
        {
          "w": "pear",
          "hl": "ear",
          "cn": "梨"
        }
      ]
    },
    {
      "id": "ue",
      "sym": "/ʊə/",
      "group": "vowel",
      "section": "双元音",
      "word": "tour",
      "highlight": "our",
      "cn": "旅行",
      "spell": "our, ure",
      "voiced": true,
      "tip": "从 /ʊ/ 滑向 /ə/，前重后轻。",
      "words": [
        {
          "w": "tour",
          "hl": "our",
          "cn": "旅行"
        },
        {
          "w": "poor",
          "hl": "oor",
          "cn": "贫穷的"
        },
        {
          "w": "sure",
          "hl": "ure",
          "cn": "确定的"
        },
        {
          "w": "cure",
          "hl": "ure",
          "cn": "治愈"
        },
        {
          "w": "tourist",
          "hl": "our",
          "cn": "游客"
        }
      ]
    },
    {
      "id": "p",
      "sym": "/p/",
      "group": "consonant",
      "section": "爆破音",
      "word": "pen",
      "highlight": "p",
      "cn": "钢笔",
      "spell": "p",
      "voiced": false,
      "tip": "双唇紧闭，突然放开，不振动声带。",
      "words": [
        {
          "w": "pen",
          "hl": "p",
          "cn": "钢笔"
        },
        {
          "w": "pig",
          "hl": "p",
          "cn": "猪"
        },
        {
          "w": "map",
          "hl": "p",
          "cn": "地图"
        },
        {
          "w": "happy",
          "hl": "p",
          "cn": "开心的"
        },
        {
          "w": "stop",
          "hl": "p",
          "cn": "停止"
        }
      ]
    },
    {
      "id": "b",
      "sym": "/b/",
      "group": "consonant",
      "section": "爆破音",
      "word": "bag",
      "highlight": "b",
      "cn": "包",
      "spell": "b",
      "voiced": true,
      "tip": "双唇紧闭，突然放开，振动声带。",
      "words": [
        {
          "w": "bag",
          "hl": "b",
          "cn": "包"
        },
        {
          "w": "book",
          "hl": "b",
          "cn": "书"
        },
        {
          "w": "big",
          "hl": "b",
          "cn": "大的"
        },
        {
          "w": "rabbit",
          "hl": "b",
          "cn": "兔子"
        },
        {
          "w": "job",
          "hl": "b",
          "cn": "工作"
        }
      ]
    },
    {
      "id": "t",
      "sym": "/t/",
      "group": "consonant",
      "section": "爆破音",
      "word": "ten",
      "highlight": "t",
      "cn": "十",
      "spell": "t",
      "voiced": false,
      "tip": "舌尖抵上齿龈，突然放开，不振动声带。",
      "words": [
        {
          "w": "ten",
          "hl": "t",
          "cn": "十"
        },
        {
          "w": "cat",
          "hl": "t",
          "cn": "猫"
        },
        {
          "w": "tree",
          "hl": "t",
          "cn": "树"
        },
        {
          "w": "water",
          "hl": "t",
          "cn": "水"
        },
        {
          "w": "hat",
          "hl": "t",
          "cn": "帽子"
        }
      ]
    },
    {
      "id": "d",
      "sym": "/d/",
      "group": "consonant",
      "section": "爆破音",
      "word": "dog",
      "highlight": "d",
      "cn": "狗",
      "spell": "d",
      "voiced": true,
      "tip": "舌尖抵上齿龈，突然放开，振动声带。",
      "words": [
        {
          "w": "dog",
          "hl": "d",
          "cn": "狗"
        },
        {
          "w": "bed",
          "hl": "d",
          "cn": "床"
        },
        {
          "w": "day",
          "hl": "d",
          "cn": "天"
        },
        {
          "w": "ladder",
          "hl": "d",
          "cn": "梯子"
        },
        {
          "w": "red",
          "hl": "d",
          "cn": "红色的"
        }
      ]
    },
    {
      "id": "k",
      "sym": "/k/",
      "group": "consonant",
      "section": "爆破音",
      "word": "cat",
      "highlight": "c",
      "cn": "猫",
      "spell": "c, k, ck",
      "voiced": false,
      "tip": "舌根抵软腭，突然放开，不振动声带。",
      "words": [
        {
          "w": "cat",
          "hl": "c",
          "cn": "猫"
        },
        {
          "w": "key",
          "hl": "k",
          "cn": "钥匙"
        },
        {
          "w": "book",
          "hl": "k",
          "cn": "书"
        },
        {
          "w": "cake",
          "hl": "k",
          "cn": "蛋糕"
        },
        {
          "w": "clock",
          "hl": "ck",
          "cn": "钟"
        }
      ]
    },
    {
      "id": "g",
      "sym": "/g/",
      "group": "consonant",
      "section": "爆破音",
      "word": "good",
      "highlight": "g",
      "cn": "好的",
      "spell": "g",
      "voiced": true,
      "tip": "舌根抵软腭，突然放开，振动声带。",
      "words": [
        {
          "w": "good",
          "hl": "g",
          "cn": "好的"
        },
        {
          "w": "bag",
          "hl": "g",
          "cn": "包"
        },
        {
          "w": "girl",
          "hl": "g",
          "cn": "女孩"
        },
        {
          "w": "egg",
          "hl": "gg",
          "cn": "鸡蛋"
        },
        {
          "w": "big",
          "hl": "g",
          "cn": "大的"
        }
      ]
    },
    {
      "id": "f",
      "sym": "/f/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "fish",
      "highlight": "f",
      "cn": "鱼",
      "spell": "f, ph",
      "voiced": false,
      "tip": "上齿轻触下唇，气流从缝隙挤出，不振动声带。",
      "words": [
        {
          "w": "fish",
          "hl": "f",
          "cn": "鱼"
        },
        {
          "w": "five",
          "hl": "f",
          "cn": "五"
        },
        {
          "w": "coffee",
          "hl": "ff",
          "cn": "咖啡"
        },
        {
          "w": "leaf",
          "hl": "f",
          "cn": "叶子"
        },
        {
          "w": "phone",
          "hl": "ph",
          "cn": "电话"
        }
      ]
    },
    {
      "id": "v",
      "sym": "/v/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "very",
      "highlight": "v",
      "cn": "非常",
      "spell": "v",
      "voiced": true,
      "tip": "上齿轻触下唇，气流从缝隙挤出，振动声带。",
      "words": [
        {
          "w": "very",
          "hl": "v",
          "cn": "非常"
        },
        {
          "w": "love",
          "hl": "v",
          "cn": "爱"
        },
        {
          "w": "seven",
          "hl": "v",
          "cn": "七"
        },
        {
          "w": "video",
          "hl": "v",
          "cn": "视频"
        },
        {
          "w": "give",
          "hl": "v",
          "cn": "给"
        }
      ]
    },
    {
      "id": "th-voiceless",
      "sym": "/θ/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "think",
      "highlight": "th",
      "cn": "想",
      "spell": "th",
      "voiced": false,
      "tip": "舌尖轻放上下齿间，气流挤出，不振动声带。",
      "words": [
        {
          "w": "think",
          "hl": "th",
          "cn": "想"
        },
        {
          "w": "three",
          "hl": "th",
          "cn": "三"
        },
        {
          "w": "mouth",
          "hl": "th",
          "cn": "嘴"
        },
        {
          "w": "math",
          "hl": "th",
          "cn": "数学"
        },
        {
          "w": "bath",
          "hl": "th",
          "cn": "洗澡"
        }
      ]
    },
    {
      "id": "th-voiced",
      "sym": "/ð/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "this",
      "highlight": "th",
      "cn": "这个",
      "spell": "th",
      "voiced": true,
      "tip": "舌尖轻放上下齿间，气流挤出，振动声带。",
      "words": [
        {
          "w": "this",
          "hl": "th",
          "cn": "这个"
        },
        {
          "w": "that",
          "hl": "th",
          "cn": "那个"
        },
        {
          "w": "mother",
          "hl": "th",
          "cn": "妈妈"
        },
        {
          "w": "brother",
          "hl": "th",
          "cn": "兄弟"
        },
        {
          "w": "they",
          "hl": "th",
          "cn": "他们"
        }
      ]
    },
    {
      "id": "s",
      "sym": "/s/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "sun",
      "highlight": "s",
      "cn": "太阳",
      "spell": "s, c",
      "voiced": false,
      "tip": "舌尖靠近上齿龈，气流从缝隙挤出，不振动声带。",
      "words": [
        {
          "w": "sun",
          "hl": "s",
          "cn": "太阳"
        },
        {
          "w": "see",
          "hl": "s",
          "cn": "看见"
        },
        {
          "w": "bus",
          "hl": "s",
          "cn": "公共汽车"
        },
        {
          "w": "city",
          "hl": "c",
          "cn": "城市"
        },
        {
          "w": "kiss",
          "hl": "ss",
          "cn": "吻"
        }
      ]
    },
    {
      "id": "z",
      "sym": "/z/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "zoo",
      "highlight": "z",
      "cn": "动物园",
      "spell": "z, s",
      "voiced": true,
      "tip": "舌尖靠近上齿龈，气流从缝隙挤出，振动声带。",
      "words": [
        {
          "w": "zoo",
          "hl": "z",
          "cn": "动物园"
        },
        {
          "w": "zero",
          "hl": "z",
          "cn": "零"
        },
        {
          "w": "nose",
          "hl": "s",
          "cn": "鼻子"
        },
        {
          "w": "busy",
          "hl": "s",
          "cn": "忙的"
        },
        {
          "w": "easy",
          "hl": "s",
          "cn": "容易的"
        }
      ]
    },
    {
      "id": "sh",
      "sym": "/ʃ/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "ship",
      "highlight": "sh",
      "cn": "船",
      "spell": "sh, ti, ci",
      "voiced": false,
      "tip": "舌端靠近齿龈后部，嘴唇略圆，不振动声带。",
      "words": [
        {
          "w": "ship",
          "hl": "sh",
          "cn": "船"
        },
        {
          "w": "shop",
          "hl": "sh",
          "cn": "商店"
        },
        {
          "w": "fish",
          "hl": "sh",
          "cn": "鱼"
        },
        {
          "w": "station",
          "hl": "ti",
          "cn": "车站"
        },
        {
          "w": "sure",
          "hl": "s",
          "cn": "确定的"
        }
      ]
    },
    {
      "id": "zh",
      "sym": "/ʒ/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "television",
      "highlight": "s",
      "cn": "电视",
      "spell": "s, ge",
      "voiced": true,
      "tip": "舌端靠近齿龈后部，嘴唇略圆，振动声带。",
      "words": [
        {
          "w": "television",
          "hl": "s",
          "cn": "电视"
        },
        {
          "w": "measure",
          "hl": "s",
          "cn": "测量"
        },
        {
          "w": "pleasure",
          "hl": "s",
          "cn": "快乐"
        },
        {
          "w": "vision",
          "hl": "si",
          "cn": "视力"
        },
        {
          "w": "usual",
          "hl": "s",
          "cn": "通常的"
        }
      ]
    },
    {
      "id": "h",
      "sym": "/h/",
      "group": "consonant",
      "section": "摩擦音",
      "word": "hat",
      "highlight": "h",
      "cn": "帽子",
      "spell": "h",
      "voiced": false,
      "tip": "气流从喉咙轻轻呼出，不振动声带。",
      "words": [
        {
          "w": "hat",
          "hl": "h",
          "cn": "帽子"
        },
        {
          "w": "house",
          "hl": "h",
          "cn": "房子"
        },
        {
          "w": "happy",
          "hl": "h",
          "cn": "开心的"
        },
        {
          "w": "hello",
          "hl": "h",
          "cn": "你好"
        },
        {
          "w": "behind",
          "hl": "h",
          "cn": "在后面"
        }
      ]
    },
    {
      "id": "ch",
      "sym": "/tʃ/",
      "group": "consonant",
      "section": "破擦音",
      "word": "chair",
      "highlight": "ch",
      "cn": "椅子",
      "spell": "ch, tch",
      "voiced": false,
      "tip": "舌端抵齿龈后部，先阻塞再摩擦，不振动声带。",
      "words": [
        {
          "w": "chair",
          "hl": "ch",
          "cn": "椅子"
        },
        {
          "w": "cheese",
          "hl": "ch",
          "cn": "奶酪"
        },
        {
          "w": "watch",
          "hl": "tch",
          "cn": "手表"
        },
        {
          "w": "teacher",
          "hl": "ch",
          "cn": "老师"
        },
        {
          "w": "church",
          "hl": "ch",
          "cn": "教堂"
        }
      ]
    },
    {
      "id": "j",
      "sym": "/dʒ/",
      "group": "consonant",
      "section": "破擦音",
      "word": "jump",
      "highlight": "j",
      "cn": "跳",
      "spell": "j, g, dge",
      "voiced": true,
      "tip": "舌端抵齿龈后部，先阻塞再摩擦，振动声带。",
      "words": [
        {
          "w": "jump",
          "hl": "j",
          "cn": "跳"
        },
        {
          "w": "juice",
          "hl": "j",
          "cn": "果汁"
        },
        {
          "w": "bridge",
          "hl": "dge",
          "cn": "桥"
        },
        {
          "w": "age",
          "hl": "ge",
          "cn": "年龄"
        },
        {
          "w": "giant",
          "hl": "g",
          "cn": "巨人"
        }
      ]
    },
    {
      "id": "tr",
      "sym": "/tr/",
      "group": "consonant",
      "section": "破擦音",
      "word": "tree",
      "highlight": "tr",
      "cn": "树",
      "spell": "tr",
      "voiced": false,
      "tip": "舌尖抵齿龈后部，先阻塞再摩擦，不振动声带。",
      "words": [
        {
          "w": "tree",
          "hl": "tr",
          "cn": "树"
        },
        {
          "w": "train",
          "hl": "tr",
          "cn": "火车"
        },
        {
          "w": "try",
          "hl": "tr",
          "cn": "尝试"
        },
        {
          "w": "street",
          "hl": "tr",
          "cn": "街道"
        },
        {
          "w": "truck",
          "hl": "tr",
          "cn": "卡车"
        }
      ]
    },
    {
      "id": "dr",
      "sym": "/dr/",
      "group": "consonant",
      "section": "破擦音",
      "word": "dress",
      "highlight": "dr",
      "cn": "连衣裙",
      "spell": "dr",
      "voiced": true,
      "tip": "舌尖抵齿龈后部，先阻塞再摩擦，振动声带。",
      "words": [
        {
          "w": "dress",
          "hl": "dr",
          "cn": "连衣裙"
        },
        {
          "w": "drink",
          "hl": "dr",
          "cn": "喝"
        },
        {
          "w": "drive",
          "hl": "dr",
          "cn": "开车"
        },
        {
          "w": "dream",
          "hl": "dr",
          "cn": "梦"
        },
        {
          "w": "children",
          "hl": "dr",
          "cn": "孩子们"
        }
      ]
    },
    {
      "id": "ts",
      "sym": "/ts/",
      "group": "consonant",
      "section": "破擦音",
      "word": "cats",
      "highlight": "ts",
      "cn": "猫（复数）",
      "spell": "ts, tes",
      "voiced": false,
      "tip": "舌尖抵齿龈，先阻塞再摩擦，不振动声带。",
      "words": [
        {
          "w": "cats",
          "hl": "ts",
          "cn": "猫（复数）"
        },
        {
          "w": "hats",
          "hl": "ts",
          "cn": "帽子"
        },
        {
          "w": "sits",
          "hl": "ts",
          "cn": "坐"
        },
        {
          "w": "boats",
          "hl": "ts",
          "cn": "船"
        },
        {
          "w": "pets",
          "hl": "ts",
          "cn": "宠物"
        }
      ]
    },
    {
      "id": "dz",
      "sym": "/dz/",
      "group": "consonant",
      "section": "破擦音",
      "word": "beds",
      "highlight": "ds",
      "cn": "床（复数）",
      "spell": "ds, des",
      "voiced": true,
      "tip": "舌尖抵齿龈，先阻塞再摩擦，振动声带。",
      "words": [
        {
          "w": "beds",
          "hl": "ds",
          "cn": "床（复数）"
        },
        {
          "w": "reads",
          "hl": "ds",
          "cn": "读"
        },
        {
          "w": "words",
          "hl": "ds",
          "cn": "单词"
        },
        {
          "w": "cards",
          "hl": "ds",
          "cn": "卡片"
        },
        {
          "w": "birds",
          "hl": "ds",
          "cn": "鸟"
        }
      ]
    },
    {
      "id": "m",
      "sym": "/m/",
      "group": "consonant",
      "section": "鼻音",
      "word": "man",
      "highlight": "m",
      "cn": "男人",
      "spell": "m",
      "voiced": true,
      "tip": "双唇紧闭，气流从鼻腔出，振动声带。",
      "words": [
        {
          "w": "man",
          "hl": "m",
          "cn": "男人"
        },
        {
          "w": "milk",
          "hl": "m",
          "cn": "牛奶"
        },
        {
          "w": "mum",
          "hl": "m",
          "cn": "妈妈"
        },
        {
          "w": "summer",
          "hl": "mm",
          "cn": "夏天"
        },
        {
          "w": "time",
          "hl": "m",
          "cn": "时间"
        }
      ]
    },
    {
      "id": "n",
      "sym": "/n/",
      "group": "consonant",
      "section": "鼻音",
      "word": "nose",
      "highlight": "n",
      "cn": "鼻子",
      "spell": "n",
      "voiced": true,
      "tip": "舌尖抵上齿龈，气流从鼻腔出，振动声带。",
      "words": [
        {
          "w": "nose",
          "hl": "n",
          "cn": "鼻子"
        },
        {
          "w": "name",
          "hl": "n",
          "cn": "名字"
        },
        {
          "w": "sun",
          "hl": "n",
          "cn": "太阳"
        },
        {
          "w": "dinner",
          "hl": "nn",
          "cn": "晚餐"
        },
        {
          "w": "ten",
          "hl": "n",
          "cn": "十"
        }
      ]
    },
    {
      "id": "ng",
      "sym": "/ŋ/",
      "group": "consonant",
      "section": "鼻音",
      "word": "sing",
      "highlight": "ng",
      "cn": "唱歌",
      "spell": "ng, n",
      "voiced": true,
      "tip": "舌根抵软腭，气流从鼻腔出，振动声带。",
      "words": [
        {
          "w": "sing",
          "hl": "ng",
          "cn": "唱歌"
        },
        {
          "w": "song",
          "hl": "ng",
          "cn": "歌曲"
        },
        {
          "w": "ring",
          "hl": "ng",
          "cn": "戒指"
        },
        {
          "w": "long",
          "hl": "ng",
          "cn": "长的"
        },
        {
          "w": "English",
          "hl": "ng",
          "cn": "英语"
        }
      ]
    },
    {
      "id": "l",
      "sym": "/l/",
      "group": "consonant",
      "section": "舌侧音",
      "word": "lion",
      "highlight": "l",
      "cn": "狮子",
      "spell": "l",
      "voiced": true,
      "tip": "舌尖抵上齿龈，气流从舌两侧出，振动声带。",
      "words": [
        {
          "w": "lion",
          "hl": "l",
          "cn": "狮子"
        },
        {
          "w": "look",
          "hl": "l",
          "cn": "看"
        },
        {
          "w": "ball",
          "hl": "ll",
          "cn": "球"
        },
        {
          "w": "yellow",
          "hl": "l",
          "cn": "黄色的"
        },
        {
          "w": "milk",
          "hl": "l",
          "cn": "牛奶"
        }
      ]
    },
    {
      "id": "r",
      "sym": "/r/",
      "group": "consonant",
      "section": "半元音",
      "word": "red",
      "highlight": "r",
      "cn": "红色",
      "spell": "r",
      "voiced": true,
      "tip": "舌尖卷起但不碰上腭，嘴唇略圆，振动声带。",
      "words": [
        {
          "w": "red",
          "hl": "r",
          "cn": "红色"
        },
        {
          "w": "run",
          "hl": "r",
          "cn": "跑"
        },
        {
          "w": "rain",
          "hl": "r",
          "cn": "雨"
        },
        {
          "w": "carrot",
          "hl": "r",
          "cn": "胡萝卜"
        },
        {
          "w": "very",
          "hl": "r",
          "cn": "非常"
        }
      ]
    },
    {
      "id": "y",
      "sym": "/j/",
      "group": "consonant",
      "section": "半元音",
      "word": "yes",
      "highlight": "y",
      "cn": "是的",
      "spell": "y",
      "voiced": true,
      "tip": "舌前部抬向硬腭，很快滑向元音，振动声带。",
      "words": [
        {
          "w": "yes",
          "hl": "y",
          "cn": "是的"
        },
        {
          "w": "you",
          "hl": "y",
          "cn": "你"
        },
        {
          "w": "yellow",
          "hl": "y",
          "cn": "黄色的"
        },
        {
          "w": "year",
          "hl": "y",
          "cn": "年"
        },
        {
          "w": "music",
          "hl": "u",
          "cn": "音乐"
        }
      ]
    },
    {
      "id": "w",
      "sym": "/w/",
      "group": "consonant",
      "section": "半元音",
      "word": "water",
      "highlight": "w",
      "cn": "水",
      "spell": "w, wh",
      "voiced": true,
      "tip": "双唇收圆前突，很快滑向元音，振动声带。",
      "words": [
        {
          "w": "water",
          "hl": "w",
          "cn": "水"
        },
        {
          "w": "we",
          "hl": "w",
          "cn": "我们"
        },
        {
          "w": "window",
          "hl": "w",
          "cn": "窗户"
        },
        {
          "w": "swim",
          "hl": "w",
          "cn": "游泳"
        },
        {
          "w": "queen",
          "hl": "qu",
          "cn": "女王"
        }
      ]
    }
  ]
};
