/* ============================================================================
 *  readings.js  —  観相アプリの「人相学・知識ベース」
 *
 *  ・MediaPipe の 478 点ランドマークから 16 種類の「相」を測定し、
 *    最も特徴の出ている相を「強み」、次点を「弱点＋開運法」として返します。
 *  ・東洋（観相・面相学）と西洋（フィジオグノミー）をバランスよく混ぜ、
 *    親しみやすい語り口にしてあります。あくまでエンタメ用です。
 *
 *  使い方（index.html 側）:
 *      import { analyzeFace } from "./readings.js";
 *      const report = analyzeFace(landmarks, imageWidth, imageHeight);
 *
 *  analyzeFace の戻り値の形:
 *  {
 *    headline: { term: "…", title: "…", body: "…" },   // 無料で見せる強み
 *    overview: "…",                                      // 三停バランスの総評
 *    locked:   [ { term, weakness, kaiun }, … ]          // 課金で開く弱点(3つ)
 *  }
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 1. ランドマーク番号（MediaPipe FaceMesh の標準インデックス）
 * ------------------------------------------------------------------------- */
const IDX = {
  faceL: 234, faceR: 454, faceTop: 10, chin: 152,
  eyeLout: 33, eyeLin: 133, eyeRin: 362, eyeRout: 263,
  eyeLtop: 159, eyeLbot: 145, eyeRtop: 386, eyeRbot: 374,
  browLpeak: 105, browLin: 55, browLout: 46,
  browRpeak: 334, browRin: 285, browRout: 276,
  noseBridge: 168, noseTip: 1, noseBase: 2,
  noseWingL: 49, noseWingR: 279,
  lipTop: 0, lipBot: 17, mouthL: 61, mouthR: 291,
  jawL: 172, jawR: 397
};

/* ---------------------------------------------------------------------------
 * 2. 16 種類の相を測る
 *    すべて顔幅・顔高で正規化し、平均値(mid)からのズレ(dev)で強さを判定。
 * ------------------------------------------------------------------------- */
function measure(lm, W, H){
  const P = i => ({ x: lm[i].x * W, y: lm[i].y * H });
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const faceW = d(P(IDX.faceL), P(IDX.faceR));
  const faceH = d(P(IDX.faceTop), P(IDX.chin));

  // 三停（顔の上・中・下の3ゾーン）
  const browY  = (P(IDX.browLpeak).y + P(IDX.browRpeak).y) / 2;
  const upper  = browY - P(IDX.faceTop).y;          // 上停（額）
  const middle = P(IDX.noseBase).y - browY;          // 中停（眉〜鼻）
  const lower  = P(IDX.chin).y - P(IDX.noseBase).y;   // 下停（鼻〜顎）

  // 目
  const eyeWL = d(P(IDX.eyeLout), P(IDX.eyeLin));
  const interocular = d(P(IDX.eyeLin), P(IDX.eyeRin));
  const eyeOpen = (d(P(IDX.eyeLtop), P(IDX.eyeLbot)) + d(P(IDX.eyeRtop), P(IDX.eyeRbot))) / 2;
  // 目尻の角度（内側より外側が上＝上がり目）
  const slantL = P(IDX.eyeLin).y - P(IDX.eyeLout).y;
  const slantR = P(IDX.eyeRin).y - P(IDX.eyeRout).y;
  const eyeSlant = ((slantL + slantR) / 2) / eyeWL;

  // 眉
  const browGap = (((P(IDX.eyeLtop).y - P(IDX.browLpeak).y) +
                    (P(IDX.eyeRtop).y - P(IDX.browRpeak).y)) / 2) / faceH;
  const browLen = (d(P(IDX.browLin), P(IDX.browLout)) +
                   d(P(IDX.browRin), P(IDX.browRout))) / 2 / eyeWL;
  const archL = (P(IDX.browLin).y + P(IDX.browLout).y) / 2 - P(IDX.browLpeak).y;
  const archR = (P(IDX.browRin).y + P(IDX.browRout).y) / 2 - P(IDX.browRpeak).y;
  const browArch = ((archL + archR) / 2) / faceH;

  // 鼻
  const noseLen   = d(P(IDX.noseBridge), P(IDX.noseBase)) / faceH;
  const noseWidth = d(P(IDX.noseWingL), P(IDX.noseWingR)) / faceW;

  // 口・唇
  const mouthW = d(P(IDX.mouthL), P(IDX.mouthR)) / faceW;
  const lipThick = d(P(IDX.lipTop), P(IDX.lipBot)) / faceH;
  const lipCenterY = (P(IDX.lipTop).y + P(IDX.lipBot).y) / 2;
  const cornerY = (P(IDX.mouthL).y + P(IDX.mouthR).y) / 2;
  const mouthCorner = (lipCenterY - cornerY) / faceH;   // 正＝口角上がり

  // 人中（鼻の下〜上唇）
  const philtrum = (P(IDX.lipTop).y - P(IDX.noseBase).y) / faceH;

  // 地閣（顎・エラ）
  const jaw = d(P(IDX.jawL), P(IDX.jawR)) / faceW;

  // 左右対称
  const cx = (P(IDX.faceL).x + P(IDX.faceR).x) / 2;
  const pairs = [[IDX.eyeLout, IDX.eyeRout], [IDX.mouthL, IDX.mouthR],
                 [IDX.browLpeak, IDX.browRpeak], [IDX.eyeLin, IDX.eyeRin]];
  let asym = 0;
  for (const [l, r] of pairs) asym += Math.abs((cx - P(l).x) - (P(r).x - cx));
  const symmetry = 1 - (asym / pairs.length / faceW);

  return {
    faceShape: faceW / faceH,
    eyeSpacing: interocular / faceW,
    eyeSize: eyeOpen / eyeWL,
    eyeSlant, browGap, browLen, browArch,
    noseLen, noseWidth, mouthW, lipThick, mouthCorner,
    philtrum, jaw, symmetry,
    _zones: { upper, middle, lower }
  };
}

/* ---------------------------------------------------------------------------
 * 3. 各相の「平均値」と「広がり」、そして読み解き文
 *    high = 値が大きい側 / low = 小さい側
 *    各極に term(伝統用語) / title(見出し) / strength / detail / weakness / kaiun
 * ------------------------------------------------------------------------- */
const READINGS = {

  faceShape: { mid: 0.745, spread: 0.05,
    high: { term:"円相（丸顔）", title:"その場の空気をやわらかくする人",
      strength:"丸みのある輪郭は、人相学でいう『円相』。まわりを安心させ、自然と人が集まってくる相です。",
      detail:"初対面でも相手の警戒をふっとほどく力があり、あなたが一人いるだけで、その場の緊張がやわらぎます。",
      weakness:"頼られると断れず、つい抱え込みがち。「いい人」でいようとして自分の予定を後回しにしていませんか。",
      kaiun:"月に一度、何の予定も入れない『自分の日』を先に手帳へ書き込みましょう。" },
    low:  { term:"長相（面長）", title:"物事を深く考え抜く思索家",
      strength:"縦に伸びた端正な輪郭は『長相』。表面で満足せず、本質まで掘り下げる知性の相です。",
      detail:"あなたの言葉には重みが宿り、軽はずみに結論を出さない分、まわりから一目置かれます。",
      weakness:"考えすぎて一歩目が遅れがち。熟考の長所が、ときに『好機を逃す』形で出てしまいます。",
      kaiun:"迷ったら3秒で決める——小さな即断を積んで『決める筋肉』を鍛えましょう。" } },

  eyeSpacing: { mid: 0.355, spread: 0.04,
    high: { term:"離れ目", title:"森を見渡せる大局観の持ち主",
      strength:"目と目の間にゆとりがある『離れ目』は、視野が広く全体像から未来を描ける戦略家の相。",
      detail:"細部にとらわれず物事を俯瞰できるので、人が見落とす大きな流れに最初に気づけます。",
      weakness:"興味が広がりすぎて詰めが甘くなることも。面白いものが多すぎて、やり切る前に次へ向かいがち。",
      kaiun:"毎朝『今日やる3つ』だけを紙に書き、それ以外は明日に回しましょう。" },
    low:  { term:"寄り目", title:"一点を磨き上げる職人気質",
      strength:"間隔がきゅっと締まった相は、集中力と没入の人。本気を出した仕事は細部まで美しく仕上がります。",
      detail:"一つのことに深く潜れるため、専門性で勝負する道であなたの真価が発揮されます。",
      weakness:"集中するほど周りが見えなくなり、一人で抱え込みやすい一面も。",
      kaiun:"週に一度、進み具合を誰かに話す『報告の時間』を作りましょう。" } },

  eyeSize: { mid: 0.30, spread: 0.06,
    high: { term:"大目（だいもく）", title:"人を惹きつける豊かな表現力",
      strength:"大きく開いた目は、感情がそのまま輝きになる相。喜怒哀楽が不思議とまわりの心を動かします。",
      detail:"あなたの『楽しい』は伝染し、場を明るくする。人前に立つ仕事と相性のいい相です。",
      weakness:"感受性が強く、人混みや刺激で気疲れしやすい。受け取る情報量が多い分、知らぬ間に消耗しがち。",
      kaiun:"夜は早めに画面を閉じ、目と心を休める時間を確保しましょう。" },
    low:  { term:"細目（さいもく）", title:"本質を見抜くクールな観察眼",
      strength:"切れ長の目は、感情に流されず物事の芯を見抜く相。いざという場面の判断を頼りにされます。",
      detail:"派手さより信頼で勝負するタイプ。静かな分析力が、長く付き合うほど評価されます。",
      weakness:"本心が伝わりにくく誤解されることも。落ち着きが『冷たい』と取られて損をする場面が。",
      kaiun:"一日一回、思っていることを言葉にして相手に渡してみましょう。" } },

  eyeSlant: { mid: 0.0, spread: 0.06,
    high: { term:"上がり目（つり目）", title:"芯の強い意志と行動力",
      strength:"目尻が上がった相は、決めたら迷わない意志の強さ。勝負どころで前へ出られる人です。",
      detail:"凛とした印象を与え、リーダーや交渉の場で『この人は本気だ』と相手に伝わります。",
      weakness:"押しの強さが、時に相手を身構えさせることも。正論で詰めすぎる癖に注意。",
      kaiun:"言い切る前に『どう思う?』と一言添える——強さに余白を持たせましょう。" },
    low:  { term:"下がり目（たれ目）", title:"人の懐にすっと入る親しみやすさ",
      strength:"目尻が下がった相は、相手の警戒を解く柔和さ。初対面でも好かれ、相談を持ちかけられる人です。",
      detail:"穏やかな目元は人を安心させ、敵を作りにくい。チームの潤滑油として重宝されます。",
      weakness:"人当たりの良さゆえ、頼まれごとを断れず損を引き受けがち。",
      kaiun:"『できない時はできないと言う』を一日ひとつ実践してみましょう。" } },

  browGap: { mid: 0.075, spread: 0.025,
    high: { term:"田宅宮が広い（離れ眉）", title:"何があっても動じない包容力",
      strength:"眉と目の間（人相学でいう『田宅宮』）が広い相は、感情の波が静かで、人の拠りどころになれる人。",
      detail:"隣にいるだけで安心される落ち着き。長期戦やトラブル対応で頼られる相です。",
      weakness:"のんびりして好機を逃すことも。余裕が『先延ばし』に化ける瞬間に注意。",
      kaiun:"気になったことは、その日のうちに一歩だけ進めておきましょう。" },
    low:  { term:"田宅宮が狭い（詰まり眉）", title:"やり遂げる集中力と情熱",
      strength:"眉が目に近い相は、一度決めたら最後までやり抜く芯の強さ。本気は周囲を黙らせる力があります。",
      detail:"短期決戦やスタートダッシュに強く、熱量で物事を前に進めるタイプです。",
      weakness:"自分にも他人にも厳しくなりがち。高い基準が気疲れや衝突の原因になることも。",
      kaiun:"一日の終わりに、自分を褒める言葉を一つ書き残しましょう。" } },

  browLen: { mid: 1.05, spread: 0.18,
    high: { term:"長眉", title:"情に厚く人付き合いが豊か",
      strength:"目より長い眉は、兄弟・友人運に恵まれる相とされ、人とのご縁を大切にできる温かさを表します。",
      detail:"困っている人を放っておけず、気づけば慕われている。人脈があなたの財産になります。",
      weakness:"人に尽くしすぎて、自分のことが後回しになりがち。",
      kaiun:"月に一度は『自分のための時間とお金』を意識して使いましょう。" },
    low:  { term:"短眉", title:"潔く自立したマイペース",
      strength:"短く整った眉は、群れずに自分の足で立てる独立心の相。決断が早く、身軽に動けます。",
      detail:"人に頼らず物事を進められるので、新しい環境にもすぐ馴染めるタフさがあります。",
      weakness:"一人で完結しようとして、頼るのが苦手。抱え込みのサインに気づきにくい一面も。",
      kaiun:"『これお願いできる?』を週に一度は口にしてみましょう。" } },

  browArch: { mid: 0.018, spread: 0.012,
    high: { term:"アーチ眉", title:"感性ゆたかな表現者",
      strength:"カーブを描く眉は、美意識と感受性の相。空気や雰囲気を読み取り、表現に変える力があります。",
      detail:"デザイン・接客・企画など、『センス』がものを言う場であなたらしさが光ります。",
      weakness:"気分の起伏が表に出やすく、調子の波が成果に影響することも。",
      kaiun:"調子のいい時間帯を把握し、大事な仕事をそこに寄せましょう。" },
    low:  { term:"一文字眉", title:"ブレない芯を持つ実直さ",
      strength:"まっすぐな一文字眉は、意志が強く約束を守る相。『あの人なら間違いない』と信頼される人です。",
      detail:"感情に流されず筋を通せるので、責任ある立場や数字を扱う仕事で力を発揮します。",
      weakness:"真面目さゆえ融通が利きにくく、自分を追い込みすぎることも。",
      kaiun:"週に一度は『まあいっか』と肩の力を抜く日を作りましょう。" } },

  noseLen: { mid: 0.27, spread: 0.05,
    high: { term:"長い鼻", title:"美意識とこだわりの人",
      strength:"すっと長い鼻は、品格と美意識の相。妥協せず、自分の世界観を持っている人です。",
      detail:"細部までこだわり抜く姿勢が、仕事の質や持ち物の趣味のよさに表れます。",
      weakness:"理想が高く、人や物事に注文が多くなりがち。完璧を求めて疲れることも。",
      kaiun:"『70点で合格』のラインを決めて、自分にも他人にも余白を。" },
    low:  { term:"短い鼻", title:"フットワークの軽い行動派",
      strength:"短めの鼻は、細かいことにこだわらず動ける相。決断と行動が早く、チャンスを掴むのが上手です。",
      detail:"考えるより先に体が動くタイプ。経験から学び、勢いで道を切り拓いていけます。",
      weakness:"勢い任せで詰めが甘くなることも。後から細部の調整に追われがち。",
      kaiun:"動き出す前に『最後の確認を一つだけ』する習慣をつけましょう。" } },

  noseWidth: { mid: 0.255, spread: 0.035,
    high: { term:"小鼻が張る（財帛宮）", title:"地に足のついた現実派",
      strength:"小鼻に張りのある相は、人相学でいう『財帛宮』が豊かなタイプ。生活力があり、金運・実行力に恵まれます。",
      detail:"夢を語るだけでなく、ちゃんと形にして暮らしを築ける堅実さがあなたの強みです。",
      weakness:"現実的すぎて、損得で動いていると思われることも。",
      kaiun:"見返りを求めない『ちょっとした親切』を週に一度。巡って返ってきます。" },
    low:  { term:"小鼻が控えめ", title:"欲の少ない清らかさ",
      strength:"小鼻が控えめな相は、執着が薄く欲の少ない人。さっぱりとして、人と争わない品があります。",
      detail:"見栄や競争に振り回されないので、自分のペースで穏やかに生きられます。",
      weakness:"遠慮が過ぎて、もらえるはずの評価やチャンスを自分から手放すことも。",
      kaiun:"『欲しい』『やりたい』を月に一度は声に出して主張してみましょう。" } },

  mouthW: { mid: 0.43, spread: 0.05,
    high: { term:"大きな口", title:"人を巻き込む行動力とリーダーシップ",
      strength:"横に広い口は、声と意志で人を動かす相。『やろう』の一言で自然と人が集まってきます。",
      detail:"エネルギーと発信力にあふれ、場を引っ張る役割であなたの魅力が最大化します。",
      weakness:"勢いで動き、あとから調整に追われがち。走り出してから気づくことも。",
      kaiun:"大事な決定だけは一晩寝かせて、翌朝の自分に判断させましょう。" },
    low:  { term:"小さな口", title:"言葉を選ぶ誠実な聞き上手",
      strength:"小さく結ばれた口は、軽々しく口を開かない信頼の相。あなたの一言には嘘がないと相手が感じます。",
      detail:"聞き役にまわれる落ち着きがあり、秘密を託される・相談される立場になりやすい人です。",
      weakness:"遠慮して自分の意見を後回しにしがち。出しゃばらなさが過ぎて埋もれることも。",
      kaiun:"会議では最初の一言を担当する——口火を切る役を引き受けてみましょう。" } },

  lipThick: { mid: 0.085, spread: 0.025,
    high: { term:"厚い唇", title:"情に厚く愛情ゆたか",
      strength:"ふっくらした唇は、愛情と人情の相。まわりを大切にし、温かい関係を築ける人です。",
      detail:"face to faceの信頼づくりが得意で、長く続く縁に恵まれます。もてなし上手でもあります。",
      weakness:"情が深い分、相手に尽くしすぎたり、別れを引きずったりしやすい一面も。",
      kaiun:"『与える』と『受け取る』のバランスを意識する一日を作りましょう。" },
    low:  { term:"薄い唇", title:"知的でドライな合理派",
      strength:"薄い唇は、感情より論理で動けるクールな相。物事を客観的に整理し、的確に伝えられます。",
      detail:"無駄を嫌い要点を掴むのが速いので、説明・分析・調整役として重宝されます。",
      weakness:"割り切りの良さが『冷たい』と受け取られることも。情の機微を見落としがち。",
      kaiun:"結論の前に『相手の気持ち』を一度想像する癖をつけましょう。" } },

  mouthCorner: { mid: 0.0, spread: 0.02,
    high: { term:"口角が上がる（仰月口）", title:"運を呼び込む明るさ",
      strength:"口角の上がった相は『仰月口（ぎょうげつこう）』と呼ばれ、福と人を引き寄せる笑顔の持ち主。",
      detail:"あなたの表情は周りを前向きにし、自然と応援される。第一印象で得をするタイプです。",
      weakness:"明るく振る舞う分、しんどさを溜め込んで一人で我慢してしまうことも。",
      kaiun:"無理に笑わなくていい日を作り、弱音を吐ける相手を一人持ちましょう。" },
    low:  { term:"口角が結ばれる", title:"思慮深く落ち着いた佇まい",
      strength:"きゅっと結ばれた口元は、軽々しくない落ち着きの相。物事を真剣に受け止める誠実さがあります。",
      detail:"その慎重さが信頼につながり、大事を任される場面で力を発揮します。",
      weakness:"無表情に見られて誤解されたり、近寄りがたいと思われたりすることも。",
      kaiun:"一日三回、口角を意識して上げる——表情から運の流れを変えられます。" } },

  philtrum: { mid: 0.05, spread: 0.018,
    high: { term:"人中が長い", title:"おおらかで芯の据わった人",
      strength:"鼻の下の溝（人中）が長い相は、器が大きく長寿・晩成の相とされます。じっくり実る底力の人です。",
      detail:"焦らず積み重ねるほど評価が伸びるタイプ。年を重ねるごとに味と信頼が増していきます。",
      weakness:"のんびり構えすぎて、動き出しが遅れることも。",
      kaiun:"『今日できる小さな一歩』を毎朝ひとつ決めて先に動きましょう。" },
    low:  { term:"人中が短い", title:"若々しくスピード感のある人",
      strength:"人中が短めの相は、感覚が瑞々しく反応の速い人。流行や変化をいち早く掴めます。",
      detail:"フットワーク軽く新しい波に乗れるので、変化の速い分野であなたらしさが活きます。",
      weakness:"せっかちさが出て、じっくり育てる前に見切りをつけがち。",
      kaiun:"始めたことは『最低3週間続ける』と先に決めておきましょう。" } },

  jaw: { mid: 0.72, spread: 0.07,
    high: { term:"地閣が豊か（エラ）", title:"粘り強くやり抜く意志の人",
      strength:"顎まわり（人相学でいう『地閣』）がしっかりした相は、忍耐力と実行力の塊。最後までやり遂げる人です。",
      detail:"困難に強く、基盤を固めて長く積み上げられる。晩年運・部下運に恵まれる相でもあります。",
      weakness:"頑固さが出て、一度決めると引けなくなることも。",
      kaiun:"月に一度『自分の考えを疑ってみる日』を作って、視野を広げましょう。" },
    low:  { term:"シャープな顎", title:"洗練された感性とスマートさ",
      strength:"すっきりした顎は、繊細で洗練された相。センスよく立ち回り、スマートに物事をこなせる人です。",
      detail:"美意識が高く、対人センスにも優れるので、人と接する仕事や創造的な場で輝きます。",
      weakness:"打たれ強さの面では繊細で、プレッシャーを溜め込みやすいことも。",
      kaiun:"頑張った日は、自分にちゃんとご褒美をあげて回復を大切に。" } },

  symmetry: { mid: 0.965, spread: 0.03,
    high: { term:"均整の取れた相", title:"信頼される安定感とバランス感覚",
      strength:"左右の整った相は、極端に振れず筋を通せる人。判断に『あの人が言うなら』と信頼が集まります。",
      detail:"感情と理性のバランスがよく、調整役・まとめ役として組織で重宝される相です。",
      weakness:"無難を選び冒険を避けがち。安定を守るあまり大きく跳ねる機会を見送ることも。",
      kaiun:"月に一度、結果の読めない『初めて』に挑戦してみましょう。" },
    low:  { term:"個性的な相", title:"型にはまらない独創の発想力",
      strength:"左右で表情の異なる相は、人と同じ発想に収まらない個性の証。アイデアに他にない角度があります。",
      detail:"既存の枠を疑える人なので、新しいものを生み出す場であなたの真価が出ます。",
      weakness:"気分の波が成果のムラに出やすく、安定して力を出すのが課題になることも。",
      kaiun:"調子の波を記録して、自分の『絶好調の作り方』を掴みましょう。" } }
};

/* ---------------------------------------------------------------------------
 * 4. 三停（顔の上・中・下バランス）の総評を作る
 * ------------------------------------------------------------------------- */
function zoneOverview(z){
  const total = z.upper + z.middle + z.lower;
  const r = { 上停: z.upper/total, 中停: z.middle/total, 下停: z.lower/total };
  const top = Object.keys(r).sort((a,b)=>r[b]-r[a])[0];
  const map = {
    上停:"額がゆったりとした『上停』優勢の相。発想力と理想を持ち、若い頃から知恵で道を開くタイプです。",
    中停:"眉から鼻にかけての『中停』が充実した相。働き盛りの実行力に恵まれ、自分の力で運を掴む人です。",
    下停:"顎まわりの『下停』が豊かな相。粘り強さと包容力があり、年を重ねるほど運と人望が育つ大器晩成型です。"
  };
  return map[top];
}

/* ---------------------------------------------------------------------------
 * 5. 総合：最も特徴的な相を強みに、次点を弱点(課金)にして返す
 * ------------------------------------------------------------------------- */
export function analyzeFace(lm, W, H){
  const f = measure(lm, W, H);

  const ranked = [];
  for (const key in READINGS){
    const cfg = READINGS[key];
    const dev = (f[key] - cfg.mid) / cfg.spread;
    const pole = dev >= 0 ? cfg.high : cfg.low;
    ranked.push({ key, dev: Math.abs(dev), pole });
  }
  ranked.sort((a, b) => b.dev - a.dev);

  const head = ranked[0].pole;
  const locked = ranked.slice(1, 4).map(r => ({
    term: r.pole.term,
    weakness: r.pole.weakness,
    kaiun: r.pole.kaiun
  }));

  return {
    headline: {
      term: head.term,
      title: head.title,
      body: head.strength + head.detail
    },
    overview: zoneOverview(f._zones),
    locked
  };
}
