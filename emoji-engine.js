/* Mojitap local emoji suggestion engine — version 2026-09-16.3
 * Browser-only English/Korean rules.
 * Design goals:
 * 1) always provide a useful suggestion for ordinary text,
 * 2) prefer sentence meaning over isolated trigger words,
 * 3) avoid opposite-meaning suggestions for negation/cancellation/failure,
 * 4) keep long text expressive without flooding every sentence,
 * 5) preserve URLs, emails, code, hashtags and existing emoji.
 */
(function (root) {
    'use strict';

    const VERSION = '2026-09-16.3';

    const EMOJI = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;
    const PROTECTED = /```[\s\S]*?(?:```|(?![\s\S]))|~~~[\s\S]*?(?:~~~|(?![\s\S]))|`[^`\r\n]*`|!?\[[^\]\r\n]*\]\([^\r\n)]*\)|https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:^|\s)[#@][\p{L}\p{N}_][\p{L}\p{N}_.-]*|<[^>\r\n]+>/gimu;
    const WORD = /[\p{L}\p{N}]/u;

    const FALSE_NEGATIVE = /\b(?:can['’]t wait|cannot wait|couldn['’]t be happier|not only|no wonder|no[- ]brainer|never been better|nothing short of|no problem|don['’]t give up|not bad)\b/i;
    const CONDOLENCE = /사망|별세|장례|부고|추모|유가족|명복|애도|\b(?:death|died|dead|funeral|bereavement|mourning)\b|passed away|rest in peace|condolence/i;
    const HIGH_SENSITIVITY = /자살|자해|극단적 선택|성폭력|성추행|강간|과다복용|호흡곤란|가슴 통증|의식.{0,6}없|\b(?:suicide|self[- ]harm|rape|sexual assault|overdose|chest pain)\b|cannot breathe|can['’]t breathe/i;
    const STOP_ACTION = /\b(?:do not|don['’]t|never|must not|should not|shouldn['’]t)\s+(?:ever\s+)?(?:click|tap|open|follow|visit|sign\s*up|subscribe|download|install|buy|share|send|post|publish)\b|(?:클릭|접속|열|가입|구독|다운로드|설치|구매|공유|전송|게시).{0,14}(?:하지\s*마|지\s*마|금지|안\s*돼)|(?:클릭|접속|가입|구독|설치|구매|공유|게시)\s*금지/i;
    const CANCEL = /\b(?:cancelled|canceled|cancelling|canceling|postponed|called off|on hold)\b|취소(?:됐|되|했|합|된|됨)|연기(?:됐|되|했|합|된|됨)|보류(?:됐|되|된|중)/i;
    const DELAY = /\b(?:delayed|running late|behind schedule)\b|지연(?:됐|되|된|중)|늦어지|늦어졌/i;
    const BAD_OUTCOME = /\b(?:failed|failure|unsuccessful|rejected|declined|broken|crashed|outage|error)\b|could(?:n['’]t| not) (?:save|import|upload|connect)|(?:저장|결제|연결|업로드|가져오기).{0,10}(?:실패|안\s*돼|못)|실패(?:했|합|함|한)|오류.{0,5}(?:발생|났)|고장|장애\s*발생/i;
    const NEGATED_BAD_STATUS = /\b(?:not|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|hasn['’]t|haven['’]t|didn['’]t)\s+(?:been\s+)?(?:cancelled|canceled|delayed|failed|broken|rejected|declined)\b|(?:취소|지연|실패|고장|거절).{0,8}(?:되지\s*않|하지\s*않|아니|없)/i;
    const RECOVERY_AFTER_SETBACK = /\b(?:failed|failure|setback|mistake|fell short)\b.{0,45}\b(?:but|however|still|again|retry|try again|keep going|move forward|learned)\b|(?:실패|실수|좌절).{0,35}(?:하지만|했지만|그래도|다시|재도전|계속|배웠)/i;
    const BAD_REVIEW = /(?:do not|don['’]t|wouldn['’]t|cannot|can['’]t)\s+recommend|would not recommend|waste of money|poor quality|bad experience|not worth|비추천|추천하지\s*않|돈이\s*아깝|품질.{0,8}(?:나쁘|나빠)|최악/i;
    const NEG_MOOD = /\b(?:not|isn['’]t|wasn['’]t)\s+(?:very\s+)?(?:happy|okay|fine|good)\b|\b(?:unhappy|disappointed|upset|frustrated|sad|lonely|anxious|worried)\b|기분.{0,8}좋지\s*않|행복하지\s*않|괜찮지\s*않|실망|속상|짜증|우울|슬프|외롭|걱정|불안/i;
    const UNAVAILABLE = /\b(?:not|isn['’]t|aren['’]t|cannot|can['’]t)\s+(?:currently\s+)?(?:available|supported|working|possible|allowed)\b|사용.{0,8}(?:불가|안\s*돼|못|할\s*수\s*없)|이용.{0,8}(?:불가|할\s*수\s*없)|지원하지\s*않|작동하지\s*않|가능하지\s*않/i;
    const UNCERTAIN = /\b(?:maybe|perhaps|might|not sure|unsure|could be|i guess|probably|wonder(?:ing)?)\b|아마|일지도|확실하지|모르겠|잘\s*모르|궁금/i;

    const P = (id, emojis, priority, group, phrase, words, negatives) => ({
        id,
        emojis,
        priority,
        group,
        phrase: phrase || [],
        words: words || [],
        negatives: negatives || []
    });
    const Q = (re, weight) => [re, weight];

    // Phrase matches intentionally receive more weight than isolated words.
    // This reduces errors such as "meeting good people" -> calendar and
    // "one day at a time" -> alarm clock.
    const PROFILES = [
        P('reflection', ['💭','🤔'], 96, 'mood', [
            Q(/\b(?:i(?:'ve| have)? been thinking|i think|i realize|i realised|i(?:'m| am) starting to realize|looking back|reflect(?:ing)? on|makes? me think|been wondering)\b/i, 8),
            Q(/생각해\s*보|돌이켜\s*보|돌아보|깨닫|느끼게\s*되|곰곰이/i, 8)
        ], ['think','thinking','realize','realise','reflect','wonder','생각','깨닫','돌아보']),

        P('time-passing', ['⏳','🕰️'], 95, 'life', [
            Q(/\b(?:time (?:passes|flies|goes by|moves quickly)|go(?:ne)? by so fast|went by so fast|before i knew it|over the years?|as time goes by|weeks? feel long|months? fly by)\b/i, 10),
            Q(/시간.{0,8}(?:빠르|흐르|지나|간다|가는)|세월.{0,8}(?:빠르|흐르|지나)|하루.{0,12}(?:빨리|금방).{0,8}(?:지나|갔)|시간.{0,16}(?:빨리|금방).{0,8}(?:갔|지나)|돌아보니.{0,12}(?:빠르|금방)/i, 10)
        ], ['time','years','weeks','months','시간','세월'], [Q(/\b(?:alarm|timer|deadline|due|appointment)\b|알람|타이머|마감/i, 8)]),

        P('slowdown', ['🌿','😌'], 98, 'life', [
            Q(/\b(?:slow down|doesn['’]t always have to move fast|do not have to move fast|take it slow|take things slowly|give myself time|less pressure|quiet(?:er)? pace|step back|pause and breathe)\b/i, 11),
            Q(/천천히|서두르지|빠르게만.{0,8}(?:살|가)|여유를|한숨\s*돌|속도를\s*늦/i, 11)
        ], ['slow','quiet','calm','peace','여유','천천히']),

        P('one-day-at-time', ['🌱','🚶'], 99, 'life', [
            Q(/\b(?:one day at a time|one step at a time|see where (?:it|they|this) lead|enjoy the process|trust the process|along the way|little by little)\b/i, 12),
            Q(/하루씩|하루하루|한\s*걸음씩|과정을\s*즐|천천히\s*가|어디로.{0,8}이어질/i, 12)
        ], ['process','journey','progress','과정','하루하루']),

        P('wellbeing', ['🌿','😊','😌'], 94, 'mood', [
            Q(/\b(?:make me feel good|feel better|take care of myself|good for me|well[- ]being|wellbeing|self[- ]care|peace of mind|feel more balanced)\b/i, 9),
            Q(/기분.{0,8}좋|나를.{0,8}돌보|마음.{0,8}편|균형을|행복하게/i, 9)
        ], ['wellbeing','wellness','balance','comfort','기분','마음']),

        P('rest', ['😌','🛌','🌙'], 95, 'life', [
            Q(/\b(?:get(?:ting)? enough rest|take a break|need a break|rest and recover|quiet evening|quiet night|relax(?:ing)? at home|wind down)\b/i, 10),
            Q(/충분히\s*쉬|휴식을|쉬어가|조용한\s*(?:저녁|밤)|푹\s*쉬|휴식/i, 10)
        ], ['rest','relax','sleep','evening','night','휴식','쉬다','저녁']),

        P('social-connection', ['🤝'], 93, 'social', [
            Q(/\b(?:meet(?:ing)? good people|spend time with (?:friends|family|people)|catch up with|good company|connect(?:ing)? with people|together with|people i care about)\b/i, 10),
            Q(/좋은\s*사람|친구와|가족과|사람들과.{0,8}(?:시간|함께)|만나서|함께하는/i, 10)
        ], ['friends','family','people','together','friend','사람','친구','가족','함께'], [Q(/\b(?:meeting at|meeting on|schedule a meeting|business meeting|team meeting)\b/i, 10)]),

        P('learning', ['📚','💡'], 92, 'growth', [
            Q(/\b(?:learn(?:ing)? something new|learn a new|keep learning|study something|pick up a new skill|new skill)\b/i, 10),
            Q(/새로운.{0,8}배우|배움을|공부하|새\s*기술|익히/i, 10)
        ], ['learn','learning','study','skill','course','배우','공부','학습','기술']),

        P('goal', ['🎯'], 93, 'growth', [
            Q(/\b(?:reach(?:ing)? (?:the|my|our|your) goal|achieve(?:ment| my| our| your)?|things? i want to achieve|work toward|working toward|set a goal|hit (?:the|my|our) target)\b/i, 10),
            Q(/목표를.{0,8}(?:달성|이루)|이루고\s*싶|성취하|목표를\s*향/i, 10)
        ], ['goal','achieve','target','milestone','목표','성취','달성']),

        P('growth', ['🌱','📈'], 88, 'growth', [
            Q(/\b(?:personal growth|grow as a person|getting better|improve myself|small progress|making progress|moving forward)\b/i, 8),
            Q(/성장하|나아지고|조금씩.{0,8}발전|발전하|앞으로\s*나아/i, 8)
        ], ['growth','grow','progress','improve','성장','발전','나아']),

        P('tired', ['😮‍💨','🛌'], 93, 'mood', [
            Q(/\b(?:(?:i(?:'m| am| was| felt)|feeling) tired|exhausted|worn out|long day|need to rest|need some rest|just rest|rest tonight)\b/i, 11),
            Q(/피곤|지쳤|지쳐|녹초|긴\s*하루|쉬고\s*싶/i, 11)
        ], ['tired','exhausted','피곤','지쳤']),

        P('excitement', ['🤩','✨'], 92, 'mood', [
            Q(/\b(?:i(?:'m| am) excited|so excited|really excited|excited for|excited about)\b/i, 12),
            Q(/신나|기대돼|기대되|설레/i, 12)
        ], ['excited','신나','설레']),

        P('affection', ['💛','❤️'], 92, 'mood', [
            Q(/\b(?:i love you|love you|miss you|love this|care about you)\b/i, 10),
            Q(/사랑해|보고\s*싶|소중해|아껴/i, 10)
        ], ['love','miss','사랑','소중']),

        P('pride', ['🏆','✨'], 91, 'growth', [
            Q(/\b(?:proud of|i(?:'m| am) proud|feel proud|accomplished something)\b/i, 10),
            Q(/뿌듯|자랑스|해냈다는/i, 10)
        ], ['proud','accomplished','뿌듯','자랑스']),

        P('sunset', ['🌅'], 91, 'topic', [Q(/\b(?:sunset|sunrise)\b/i, 10), Q(/노을|일출|해돋이/i, 10)], ['sunset','sunrise','노을','일출']),

        P('career', ['🧑‍💼','💼'], 86, 'topic', [
            Q(/\b(?:job interview|interview tomorrow|career change|changing jobs?|changing careers?|new job|job offer)\b/i, 10),
            Q(/면접|이직|새\s*직장|취업|채용/i, 9)
        ], ['interview','career','job','면접','이직','취업']),

        P('gratitude', ['🙏','💛'], 94, 'mood', [
            Q(/\b(?:thank you|thanks for|grateful for|appreciate|feel grateful|so thankful)\b/i, 10),
            Q(/감사|고마워|고맙|덕분/i, 10)
        ], ['thanks','thank','grateful','appreciate','감사','고맙']),

        P('joy', ['😊','😄','✨'], 90, 'mood', [
            Q(/\b(?:feel happy|feeling happy|makes? me happy|so happy|really happy|had a great time|made my day|love how|feels? amazing)\b/i, 9),
            Q(/행복해|기분이\s*좋|기뻐|즐거워|좋은\s*하루|신나/i, 9)
        ], ['happy','glad','great','wonderful','joy','행복','기쁘','즐겁','신나']),

        P('hope', ['🌟','🤞'], 87, 'mood', [
            Q(/\b(?:i hope|hopefully|looking forward to|can['’]t wait|cannot wait|wish me luck|fingers crossed)\b/i, 9),
            Q(/바라|희망|기대돼|잘됐으면|행운을/i, 9)
        ], ['hope','hopefully','wish','기대','희망']),

        P('sad', ['😔','💙'], 92, 'mood', [
            Q(/\b(?:feel sad|feeling sad|heartbroken|feeling down|miss (?:him|her|them|you)|lonely lately)\b/i, 10),
            Q(/슬퍼|속상|마음이\s*아프|외로|우울|보고\s*싶/i, 10)
        ], ['sad','lonely','upset','disappointed','슬프','외롭','속상','우울']),

        P('worry', ['😟','💭'], 90, 'mood', [
            Q(/\b(?:worry(?:ing)? about|anxious about|stressed about|can['’]t stop worrying|concerned about)\b/i, 10),
            Q(/걱정하|불안하|고민이|스트레스/i, 10)
        ], ['worry','worried','anxious','stress','concern','걱정','불안','고민'], [
            Q(/\b(?:rather than|instead of)\s+(?:constantly\s+)?worry/i, 9),
            Q(/걱정하기보다|걱정보다는/i, 9)
        ]),

        P('encouragement', ['💪','🙌'], 96, 'mood', [
            Q(/\b(?:don['’]t give up|do not give up|keep going|you can do it|you['’]ve got this|good luck|hang in there)\b/i, 12),
            Q(/포기하지\s*마|힘내|계속\s*가|할\s*수\s*있어|응원해|잘\s*될\s*거야/i, 12)
        ], ['encourage','support','응원','힘내']),

        P('greeting', ['👋','😊'], 84, 'social', [
            Q(/\b(?:hello|hi there|hey there|good morning|good afternoon|see you soon|see you tomorrow)\b/i, 9),
            Q(/안녕|좋은\s*아침|내일\s*봐|또\s*봐/i, 9)
        ], ['hello','hi','안녕']),

        P('movie', ['🎬','🍿'], 89, 'topic', [
            Q(/\b(?:movie|film|cinema|watch a movie|watching a movie)\b/i, 10),
            Q(/영화|영화관/i, 10)
        ], ['movie','film','영화']),

        P('walk', ['🚶','🌿'], 87, 'life', [
            Q(/\b(?:take a walk|took (?:a |a long )?walk|go for a walk|went for a walk|walked around|walking around|stroll)\b/i, 10),
            Q(/산책|걸어다|걸으러/i, 9)
        ], ['walk','walking','산책']),

        P('celebration', ['🎉','🥳'], 97, 'event', [
            Q(/\b(?:congratulations|congrats|graduated|graduation|we won|won the award|passed the exam|got the job)\b/i, 11),
            Q(/축하|합격했|졸업했|우승했|수상했|취업했/i, 11)
        ], ['congrats','graduation','won','축하','합격','졸업','우승']),

        P('birthday', ['🎂','🎉'], 98, 'event', [Q(/\b(?:birthday|happy anniversary)\b/i, 12), Q(/생일|기념일/i, 12)], ['birthday','생일','기념일']),
        P('launch', ['🚀','✨'], 97, 'event', [Q(/\b(?:just launched|launching today|now live|released today|available now|introducing our new)\b/i, 11), Q(/출시했|출시합니다|정식\s*오픈|서비스\s*시작|새롭게\s*선보/i, 11)], ['launch','released','출시','오픈']),
        P('deadline', ['⏰','📅'], 97, 'status', [Q(/\b(?:deadline|due today|due tomorrow|submit by|expires? today|expires? tomorrow)\b/i, 12), Q(/마감|제출\s*기한|오늘까지|내일까지/i, 12)], ['deadline','due','마감','기한']),
        P('appointment', ['📅'], 91, 'event', [Q(/\b(?:meeting at|meeting on|appointment|scheduled for|calendar event|conference at|webinar at)\b/i, 10), Q(/회의.{0,24}(?:시|예정)|약속.{0,24}(?:시|예정)|일정|세미나|웨비나/i, 10)], ['appointment','schedule','calendar','회의','약속','일정']),

        P('delivery', ['📦'], 96, 'topic', [Q(/\b(?:package|parcel|shipment|delivery)\b/i, 9), Q(/택배|배송|소포/i, 9)], ['package','delivery','shipment','택배','배송']),
        P('payment', ['💳','💰'], 89, 'topic', [Q(/\b(?:payment|invoice|checkout|paid|billing)\b/i, 8), Q(/결제|청구서|입금/i, 8)], ['payment','invoice','결제','입금']),
        P('email', ['✉️','📧'], 85, 'topic', [Q(/\b(?:email|inbox|newsletter)\b/i, 8), Q(/이메일|뉴스레터|받은편지함/i, 8)], ['email','newsletter','이메일','뉴스레터']),
        P('message', ['💬'], 80, 'topic', [Q(/\b(?:message|messages|caption|post|sentence|text)\b/i, 6), Q(/메시지|캡션|게시물|문장|텍스트/i, 6)], ['message','caption','post','메시지','캡션']),
        P('emoji', ['😀'], 88, 'topic', [Q(/\b(?:emoji|emojis|emoticon|emoticons)\b/i, 9), Q(/이모지|이모티콘/i, 9)], ['emoji','emoticon','이모지','이모티콘']),
        P('copy', ['📋'], 90, 'action', [Q(/\b(?:copy|copied|clipboard|paste|pasted)\b/i, 9), Q(/복사|붙여넣|클립보드/i, 9)], ['copy','paste','clipboard','복사','붙여넣']),
        P('edit', ['✏️','📝'], 90, 'action', [Q(/\b(?:edit every|edit manually|manually edit|edit|editing|draft|drafting|revise|revision|rewrite|writing)\b/i, 10), Q(/편집|수정|초안|작성/i, 8)], ['edit','draft','revision','편집','수정','초안']),
        P('review', ['✅','👀'], 87, 'action', [Q(/\b(?:review|check|verify|verification|confirm|proofread)\b/i, 8), Q(/검토|확인|검증|교정/i, 8)], ['review','check','confirm','검토','확인']),
        P('search', ['🔎'], 88, 'action', [Q(/\b(?:search|find|lookup|look up|browse)\b/i, 11), Q(/검색|찾기|찾아|조회|둘러보/i, 11)], ['search','find','검색','찾기']),
        P('tool', ['🛠️','⚙️'], 77, 'topic', [Q(/\b(?:tool|feature|function|utility|app|application|palette|button)\b/i, 6), Q(/도구|기능|앱|애플리케이션|팔레트|버튼/i, 6)], ['tool','feature','app','도구','기능']),
        P('language', ['🌐','🔤'], 74, 'topic', [Q(/\b(?:English|Korean|language|languages|translation|translate|unicode)\b/i, 6), Q(/영어|한국어|언어|번역|유니코드/i, 6)], ['language','unicode','언어','유니코드']),
        P('browser', ['🌐'], 72, 'topic', [Q(/\b(?:browser|website|web page|web app|online)\b/i, 6), Q(/브라우저|웹사이트|웹\s*페이지|온라인/i, 6)], ['browser','website','브라우저','웹사이트']),

        P('coffee', ['☕'], 93, 'topic', [Q(/\b(?:coffee|espresso|latte|cappuccino|cafe|café)\b/i, 10), Q(/커피|아메리카노|라떼|카페/i, 10)], ['coffee','latte','커피','라떼']),
        P('tea', ['🍵'], 91, 'topic', [Q(/\b(?:tea|matcha|green tea)\b/i, 10), Q(/녹차|홍차|말차/i, 10)], ['tea','matcha','녹차','홍차']),
        P('food', ['🍽️','😋'], 79, 'topic', [Q(/\b(?:dinner|lunch|breakfast|meal|cooking|recipe|restaurant|brunch)\b/i, 8), Q(/점심|저녁\s*식사|아침\s*식사|아침을.{0,8}만들|요리|맛집|식사|레시피/i, 9)], ['dinner','lunch','meal','food','식사','요리']),
        P('pizza', ['🍕'], 95, 'topic', [Q(/\bpizza\b/i, 12), Q(/피자/i, 12)], ['pizza','피자']),
        P('pasta', ['🍝'], 95, 'topic', [Q(/\b(?:pasta|spaghetti)\b/i, 12), Q(/파스타|스파게티/i, 12)], ['pasta','파스타']),
        P('cake', ['🍰'], 93, 'topic', [Q(/\b(?:cake|cupcake)\b/i, 11), Q(/케이크/i, 11)], ['cake','케이크']),

        P('dog', ['🐶','🐾'], 94, 'topic', [Q(/\b(?:dog|puppy|puppies|beagle|retriever)\b/i, 10), Q(/강아지|반려견/i, 10)], ['dog','puppy','강아지','반려견']),
        P('cat', ['🐱','🐾'], 94, 'topic', [Q(/\b(?:cat|kitten|kittens)\b/i, 10), Q(/고양이|반려묘/i, 10)], ['cat','kitten','고양이','반려묘']),
        P('transport', ['🚆','🚌'], 88, 'topic', [
            Q(/\b(?:train|subway|metro|bus|station|commute)\b/i, 9),
            Q(/기차|지하철|버스|역에서|출퇴근/i, 9)
        ], ['train','bus','subway','기차','버스','지하철']),

        P('outdoors', ['🌿','☀️'], 87, 'life', [
            Q(/\b(?:spend more time outside|go outside|outdoors|outside this weekend|fresh air)\b/i, 10),
            Q(/밖에서.{0,10}시간|야외에서|바깥에서|바람\s*쐬/i, 10)
        ], ['outside','outdoors','야외','밖']),

        P('notes', ['📝','💡'], 86, 'action', [
            Q(/\b(?:notebook|write down|jot down|take notes?|notes? for my ideas)\b/i, 9),
            Q(/노트|메모|적어두|기록하/i, 9)
        ], ['notebook','notes','노트','메모']),

        P('sleep', ['😴','🛌'], 91, 'life', [
            Q(/\b(?:got enough sleep|slept well|good night|go to bed|bedtime|sleep well)\b/i, 10),
            Q(/푹\s*잤|잘\s*잤|충분히\s*잤|잠을\s*잘|취침/i, 10)
        ], ['sleep','slept','잠','잤']),

        P('museum', ['🏛️'], 89, 'topic', [Q(/\b(?:museum|gallery exhibit|exhibition)\b/i, 10), Q(/박물관|미술관|전시/i, 10)], ['museum','exhibition','박물관','전시']),

        P('phone-call', ['📞'], 90, 'action', [
            Q(/\b(?:call my|call your|call the|phone call|give .* a call)\b/i, 10),
            Q(/전화하|전화해야|전화하는/i, 10)
        ], ['call','phone','전화']),

        P('hydration', ['💧','🥤'], 89, 'life', [
            Q(/\b(?:drink more water|drinking water|stay hydrated|hydration)\b/i, 10),
            Q(/물.{0,8}마시|수분.{0,8}섭취/i, 10)
        ], ['water','hydration','물','수분']),

        P('cold-weather', ['🥶','🧥'], 87, 'topic', [
            Q(/\b(?:getting colder|cold weather|freezing outside|temperature dropped)\b/i, 9),
            Q(/날씨.{0,8}추워|점점\s*추워|기온.{0,8}내려/i, 9)
        ], ['cold','colder','추워','기온']),

        P('phone-screen', ['📱'], 87, 'topic', [
            Q(/\b(?:staring at my phone|too much screen time|on my phone all day|phone screen)\b/i, 10),
            Q(/휴대폰.{0,10}(?:오래|화면)|스마트폰.{0,10}(?:오래|화면)|화면을\s*너무\s*오래/i, 10)
        ], ['phone','screen','휴대폰','스마트폰','화면']),

        P('digital-break', ['📵','🌿'], 90, 'life', [
            Q(/\b(?:take a break from social media|social media break|digital detox|step away from screens?|offline break)\b/i, 11),
            Q(/소셜\s*미디어.{0,10}쉬|SNS.{0,10}쉬|디지털\s*디톡스|화면에서.{0,8}벗어나/i, 11)
        ], ['social media','digital detox','소셜 미디어','디지털 디톡스']),

        P('travel', ['🧳','🌍'], 87, 'topic', [Q(/\b(?:trip|travel|vacation|holiday|passport|suitcase)\b/i, 9), Q(/여행|휴가|여권/i, 9)], ['trip','travel','vacation','여행','휴가']),
        P('flight', ['✈️'], 96, 'topic', [Q(/\b(?:flight|airport|airplane|boarding pass)\b/i, 11), Q(/비행기|공항|항공편/i, 11)], ['flight','airport','비행기','공항']),
        P('hotel', ['🏨'], 94, 'topic', [Q(/\b(?:hotel|hostel|resort)\b/i, 10), Q(/호텔|숙소/i, 10)], ['hotel','resort','호텔','숙소']),
        P('rain', ['🌧️','☔'], 94, 'topic', [Q(/\b(?:rain|raining|rainy|umbrella)\b/i, 10), Q(/비가\s*오|장마|우산/i, 10)], ['rain','umbrella','비','우산']),
        P('snow', ['❄️'], 94, 'topic', [Q(/\b(?:snow|snowing|snowy)\b/i, 10), Q(/눈이\s*오|폭설/i, 10)], ['snow','눈']),
        P('sunshine', ['☀️'], 93, 'topic', [Q(/\b(?:sunny|sunshine)\b/i, 10), Q(/햇살|화창/i, 10)], ['sunny','sunshine','햇살','화창']),
        P('nature', ['🌿','🌳'], 82, 'topic', [Q(/\b(?:forest|garden|park|hiking|nature|trail)\b/i, 8), Q(/숲|정원|공원|등산|자연/i, 8)], ['forest','garden','nature','숲','정원','자연']),
        P('ocean', ['🌊'], 93, 'topic', [Q(/\b(?:beach|ocean|sea|surfing)\b/i, 10), Q(/바다|해변|서핑/i, 10)], ['beach','ocean','바다','해변']),
        P('flowers', ['🌸'], 92, 'topic', [Q(/\b(?:flowers?|blossoms?)\b/i, 10), Q(/꽃|벚꽃/i, 10)], ['flower','꽃','벚꽃']),

        P('books', ['📚'], 91, 'topic', [Q(/\b(?:book|books|reading|library|novel)\b/i, 9), Q(/독서|도서관|책을|책이|소설/i, 9)], ['book','reading','책','독서']),
        P('study', ['📖','✏️'], 89, 'topic', [Q(/\b(?:studying|study|homework|class|lesson|exam)\b/i, 8), Q(/공부|수업|숙제|시험/i, 8)], ['study','exam','공부','시험']),
        P('music', ['🎵','🎧'], 91, 'topic', [Q(/\b(?:music|song|playlist|concert|singing)\b/i, 9), Q(/음악|노래|콘서트|플레이리스트/i, 9)], ['music','song','음악','노래']),
        P('photo', ['📷'], 89, 'topic', [Q(/\b(?:photo|photos|photography|camera|picture|pictures)\b/i, 11), Q(/사진|카메라|촬영/i, 11)], ['photo','camera','사진','카메라']),
        P('creative', ['🎨','✨'], 83, 'topic', [Q(/\b(?:painting|drawing|artwork|illustration|design|creative|creativity)\b/i, 8), Q(/그림|미술|일러스트|디자인|창작|창의/i, 8)], ['art','creative','design','미술','창작']),
        P('running', ['🏃'], 93, 'topic', [Q(/\b(?:run|running|jog|jogging|marathon)\b/i, 10), Q(/러닝|달리기|마라톤/i, 10)], ['running','marathon','러닝','달리기']),
        P('exercise', ['💪'], 87, 'topic', [Q(/\b(?:workout|exercis(?:e|es|ed|ing)|fitness|gym)\b/i, 10), Q(/운동|헬스/i, 9)], ['workout','exercise','운동','헬스']),
        P('sports', ['🏆'], 76, 'topic', [Q(/\b(?:game|match|sports|player|team won)\b/i, 6), Q(/경기|스포츠|선수/i, 6)], ['game','match','sports','경기','스포츠']),
        P('football', ['⚽'], 91, 'topic', [Q(/\b(?:football|soccer)\b/i, 10), Q(/축구/i, 10)], ['football','soccer','축구']),
        P('basketball', ['🏀'], 91, 'topic', [Q(/\bbasketball\b/i, 10), Q(/농구/i, 10)], ['basketball','농구']),
        P('gaming', ['🎮'], 90, 'topic', [Q(/\b(?:gaming|video game|gameplay|console|multiplayer)\b/i, 9), Q(/게임|게이밍/i, 9)], ['gaming','gameplay','게임','게이밍']),
        P('code', ['💻','⌨️'], 90, 'topic', [Q(/\b(?:coding|programming|javascript|python|developer|debugging|code)\b/i, 9), Q(/코딩|프로그래밍|개발자|자바스크립트|파이썬|코드/i, 9)], ['coding','programming','code','코딩','프로그래밍']),
        P('data', ['📊'], 89, 'topic', [Q(/\b(?:spreadsheet|dataset|analytics|chart|statistics|metrics|dashboard)\b/i, 11), Q(/데이터|엑셀|통계|스프레드시트|지표|대시보드/i, 11)], ['data','analytics','metrics','dashboard','데이터','통계','지표','대시보드']),
        P('security', ['🔒','🛡️'], 92, 'topic', [Q(/\b(?:password|encryption|privacy|security|authentication)\b/i, 10), Q(/비밀번호|암호|보안|개인정보|인증/i, 10)], ['security','privacy','보안','개인정보']),
        P('work', ['💼'], 73, 'topic', [Q(/\b(?:work|job|office|project|task|report|deadline at work)\b/i, 6), Q(/업무|직장|프로젝트|작업|보고서/i, 6)], ['work','project','업무','프로젝트']),
        P('shopping', ['🛍️','🛒'], 82, 'topic', [Q(/\b(?:shopping|shopping cart|buying clothes|go shopping)\b/i, 8), Q(/쇼핑|장바구니/i, 8)], ['shopping','cart','쇼핑','장바구니']),
        P('home', ['🏠'], 82, 'topic', [Q(/\b(?:new home|moving house|home renovation|at home)\b/i, 8), Q(/이사|새집|집들이|집에서/i, 8)], ['home','house','집','이사']),
        P('cleaning', ['🧹'], 86, 'topic', [Q(/\b(?:clean|cleaned|cleaning|declutter|tidy|tidying)\b/i, 11), Q(/청소|정리정돈/i, 11)], ['cleaning','clean','청소','정리']),
        P('repair', ['🛠️'], 87, 'topic', [Q(/\b(?:repair|fixing|maintenance|fix the)\b/i, 9), Q(/수리|정비|고치기/i, 9)], ['repair','fix','수리','정비'])
    ];

    function hasEmoji(text) {
        EMOJI.lastIndex = 0;
        return EMOJI.test(text);
    }

    function emojiCount(text) {
        EMOJI.lastIndex = 0;
        return (text.match(EMOJI) || []).length;
    }

    function maskProtected(text) {
        PROTECTED.lastIndex = 0;
        return text.replace(PROTECTED, m => m.replace(/[^\r\n]/g, ' '));
    }

    function normalize(text) {
        return text.toLowerCase().replace(/[\s.!?。！？]+/g, ' ').trim();
    }

    function tokenCount(text) {
        return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    }

    function countMatches(text, re) {
        re.lastIndex = 0;
        return re.test(text) ? 1 : 0;
    }

    function profileScore(profile, text) {
        let score = 0;
        for (const [re, weight] of profile.phrase) {
            if (countMatches(text, re)) score += weight;
        }
        const lower = text.toLowerCase();
        for (const word of profile.words) {
            if (!word) continue;
            if (/^[a-z0-9 -]+$/i.test(word)) {
                const re = new RegExp('(?:^|\\b)' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\b|$)', 'i');
                if (re.test(lower)) score += 2.2;
            } else if (lower.includes(word.toLowerCase())) {
                score += 2.2;
            }
        }
        for (const [re, weight] of profile.negatives) {
            if (countMatches(text, re)) score -= weight;
        }
        return score;
    }

    function special(id, emojis, group, confidence) {
        return { id, emojis, group: group || 'status', confidence: confidence || 20, priority: 200 };
    }

    function classifySpecial(text) {
        const working = text.replace(FALSE_NEGATIVE, ' ');
        if (CONDOLENCE.test(text)) return special('condolence', ['🕯️'], 'mood', 30);
        if (HIGH_SENSITIVITY.test(text)) return special('sensitive', ['⚠️'], 'status', 30);
        if (RECOVERY_AFTER_SETBACK.test(text)) return special('recovery', ['💪','🌱'], 'growth', 29);
        if (NEGATED_BAD_STATUS.test(text)) return special('not-bad-status', ['✅'], 'status', 28);
        if (STOP_ACTION.test(text)) return special('prohibition', ['⚠️'], 'status', 28);
        if (BAD_REVIEW.test(text)) return special('negative-review', ['👎'], 'mood', 27);
        if (NEG_MOOD.test(text)) return special('negative-mood', ['😔','😕'], 'mood', 27);
        if (UNAVAILABLE.test(text)) return special('unavailable', ['🚫'], 'status', 27);
        if (CANCEL.test(text)) return special('cancelled', ['🚫'], 'status', 28);
        if (DELAY.test(text)) return special('delayed', ['⏳'], 'status', 26);
        if (BAD_OUTCOME.test(text)) return special('failed', ['❌'], 'status', 28);
        if (/\bpayment (?:was |is |has been )?(?:approved|received|completed|successful)\b|결제.{0,6}(?:완료|승인)|입금.{0,6}확인/i.test(text)) {
            return special('payment-complete', ['✅'], 'status', 28);
        }
        if (/\b(?:finished|done|completed|saved successfully|upload complete|import complete|backup complete|report approved|task completed|project created|issue resolved)\b|\b(?:report|draft|file) (?:is |was |has been )?(?:approved|saved|ready)\b|저장.{0,5}완료|업로드.{0,5}완료|백업.{0,5}완료|초안.{0,5}완성|문제.{0,5}해결|프로젝트.{0,5}생성/i.test(text)) {
            return special('task-complete', ['✅'], 'status', 27);
        }
        if (/\b(?:went well|turned out well|worked out well|better than expected)\b|생각.{0,12}보다.{0,8}잘|잘\s*끝났|잘\s*마무리/i.test(text)) {
            return special('positive-result', ['✅','🙌'], 'status', 25);
        }
        if (/\b(?:warning|caution|beware|phishing|scam|dangerous link|security alert|urgent)\b|경고|주의하|주의해|주의\s*사항|피싱|사기\s*문자|위험한\s*링크|긴급/i.test(text)) {
            return special('warning', ['⚠️','🚨'], 'status', 27);
        }
        if (/\b(?:sorry|apologize|apologise|apology|apologies)\b|죄송|미안|사과드립니다/i.test(text)) {
            return special('apology', ['🙏','😔'], 'mood', 25);
        }
        if (/\b(?:starting|started|beginning) (?:a |the )?(?:new )?(?:project|job|course|chapter)\b|새(?:로운)?\s*(?:프로젝트|일|과정).{0,8}(?:시작|시작했)|프로젝트를\s*시작/i.test(text)) {
            return special('new-start', ['🚀'], 'event', 24);
        }
        if (/\b(?:exam|test) (?:is |was )?(?:over|finished|done)\b|시험.{0,5}(?:끝났|끝남|마쳤|끝났다)/i.test(text)) {
            return special('exam-finished', ['🎉'], 'event', 24);
        }

        if (/좋은\s*생각.{0,10}(?:아닌|아니|않)|좋은\s*아이디어.{0,10}(?:아닌|아니|않)/i.test(text)) {
            return special('negated-reflection', ['🤔','💭'], 'mood', 24);
        }

        // Nuanced negation: a negative word is not automatically a warning.
        if (/\b(?:not|never|doesn['’]t|don['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|cannot|can['’]t)\b/i.test(working) || /지\s*(?:않|안|못)|아니|없(?:다|어|습|는|음)|할\s*수\s*없/i.test(working)) {
            if (/\b(?:move fast|rush|hurry|always be productive|always work|do everything)\b|서두르|빠르게만|늘\s*생산적|항상\s*일/i.test(text)) {
                return special('negated-pressure', ['🌿','😌'], 'life', 24);
            }
            if (/\b(?:good idea|right choice|sure|certain|know|understand)\b|좋은\s*생각|맞는\s*선택|확실|알겠|이해/i.test(text)) {
                return special('negated-reflection', ['🤔','💭'], 'mood', 22);
            }
        }

        // Positive calls to action are handled only after prohibition checks.
        if (/\b(?:click|tap|visit) (?:the |this |our )?link\b|링크.{0,8}클릭/i.test(text)) return special('link-action', ['🔗'], 'action', 20);
        if (/\b(?:sign up|join us|register now)\b|가입해|가입하세|등록하세/i.test(text)) return special('signup-action', ['📝'], 'action', 20);
        if (/\bsubscribe\b|구독해|구독하세/i.test(text)) return special('subscribe-action', ['🔔'], 'action', 20);
        if (/\b(?:share this|share the|share your)\b|공유해|공유하세/i.test(text)) return special('share-action', ['📣'], 'action', 20);
        if (/\b(?:save this|bookmark this|save the)\b|저장해|저장하세|북마크/i.test(text)) return special('save-action', ['🔖'], 'action', 20);
        return null;
    }

    function scoreProfiles(text) {
        const items = [];
        for (const profile of PROFILES) {
            const score = profileScore(profile, text);
            if (score > 0) items.push({
                id: profile.id,
                emojis: profile.emojis,
                group: profile.group,
                priority: profile.priority,
                confidence: score,
                profile
            });
        }
        items.sort((a, b) => b.confidence - a.confidence || b.priority - a.priority);
        return items;
    }

    function genericFallback(text) {
        const trimmed = text.trim();
        if (!trimmed || !WORD.test(trimmed)) return null;

        if (/[?？]\s*$/.test(trimmed)) return special('generic-question', ['🤔','❓'], 'generic', 9);
        if (UNCERTAIN.test(trimmed)) return special('generic-uncertain', ['🤔','💭'], 'generic', 9);
        if (/\b(?:i|we)\b.{0,25}\b(?:think|feel|realize|remember|wonder)\b/i.test(trimmed) || /(?:나는|저는|우리는).{0,20}(?:생각|느끼|깨닫|기억|궁금)/i.test(trimmed)) {
            return special('generic-reflection', ['💭'], 'generic', 8);
        }
        if (/\b(?:friend|family|people|together|conversation|talked with|met someone)\b/i.test(trimmed) || /친구|가족|사람|함께|대화|만났/i.test(trimmed)) {
            return special('generic-social', ['🤝','😊'], 'generic', 8);
        }
        if (/\b(?:life|day|days|week|weeks|everyday|daily)\b/i.test(trimmed) || /삶|하루|일상|매일/i.test(trimmed)) {
            return special('generic-life', ['🌱','✨'], 'generic', 7.5);
        }
        if (/\b(?:start|begin|next|continue|try|trying|plan|planning)\b/i.test(trimmed) || /시작|다음|계속|시도|계획/i.test(trimmed)) {
            return special('generic-action', ['➡️','✨'], 'generic', 7.5);
        }
        if (/\b(?:good|nice|better|enjoy|enjoying|like|favorite|favourite)\b/i.test(trimmed) || /좋|즐기|마음에\s*들/i.test(trimmed)) {
            return special('generic-positive', ['😊','✨'], 'mood', 7.5);
        }
        if (/\b(?:hard|difficult|rough|problem|issue|confusing)\b/i.test(trimmed) || /어렵|힘들|문제|복잡/i.test(trimmed)) {
            return special('generic-challenge', ['🧩','💭'], 'generic', 7.5);
        }
        if (/\b(?:why|because|therefore|however|means|explain|reason)\b|왜|이유|때문|따라서|하지만|설명/i.test(trimmed)) {
            return special('generic-explanation', ['💡','🔎'], 'generic', 7);
        }
        if (/\b(?:how to|step|steps|method|guide|instructions?)\b|단계|방법|절차|가이드|사용법/i.test(trimmed)) {
            return special('generic-guide', ['📝','➡️'], 'generic', 7);
        }
        if (/[!！]\s*$/.test(trimmed)) return special('generic-emphasis', ['✨','🙌'], 'generic', 6.5);

        // Ordinary text should still get a lightweight, non-misleading suggestion.
        // Short conversational lines lean expressive; longer neutral prose stays subtle.
        if (tokenCount(trimmed) <= 6) return special('generic-short', ['✨','🙂'], 'generic', 5.5);
        if (tokenCount(trimmed) <= 16) return special('generic-medium', ['✨','💬'], 'generic', 5);
        return special('generic-long', ['✨','🌿'], 'generic', 4.5);
    }

    function analyzeSentence(text) {
        const specialResult = classifySpecial(text);
        if (specialResult) return [specialResult];

        const scored = scoreProfiles(text).filter(item => item.confidence >= 4.5);
        if (scored.length) return scored;

        const fallback = genericFallback(text);
        return fallback ? [fallback] : [];
    }

    function sentenceSlices(raw, masked) {
        const result = [];
        let start = 0;
        for (let i = 0; i < masked.length; i++) {
            if (!/[.!?。！？]/.test(masked[i])) continue;
            if (masked[i] === '.' && /[0-9]/.test(masked[i - 1] || '') && /[0-9]/.test(masked[i + 1] || '')) continue;
            if (masked[i] === '.' && /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|e\.g|i\.e)$/i.test(masked.slice(Math.max(0, i - 10), i))) continue;

            let end = i + 1;
            while (end < masked.length && /[.!?。！？"'”’\])]/.test(masked[end])) end++;
            if (end < masked.length && !/\s/.test(masked[end])) continue;

            let cursor = end;
            while (cursor < raw.length && /\s/.test(raw[cursor])) cursor++;
            let emojiEnd = end;
            while (cursor < raw.length) {
                EMOJI.lastIndex = 0;
                const next = EMOJI.exec(raw.slice(cursor));
                if (!next || next.index !== 0) break;
                cursor += next[0].length;
                emojiEnd = cursor;
                while (cursor < raw.length && /\s/.test(raw[cursor])) cursor++;
            }
            end = emojiEnd;
            result.push({ raw: raw.slice(start, end), clean: masked.slice(start, end) });
            start = end;
            i = end - 1;
        }
        if (start < raw.length) result.push({ raw: raw.slice(start), clean: masked.slice(start) });
        return result;
    }

    function stringHash(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function chooseEmoji(options, seed, recent, usedEmoji) {
        const list = [...new Set(options.filter(Boolean))];
        if (!list.length) return '';

        // Profile order expresses semantic preference. Repetition avoidance only
        // changes the choice when the preferred emoji was just used.
        for (const emoji of list) {
            if (!recent.includes(emoji) && (usedEmoji.get(emoji) || 0) === 0) return emoji;
        }
        for (const emoji of list) {
            if (!recent.includes(emoji) && (usedEmoji.get(emoji) || 0) < 2) return emoji;
        }
        return list[0];
    }

    function targetCount(sentenceCount, visibleLength, existing) {
        if (sentenceCount <= 0) return 0;
        let target;
        if (sentenceCount === 1) target = 1;
        else if (sentenceCount === 2) target = 2;
        else if (sentenceCount <= 4) target = Math.min(3, sentenceCount);
        else if (sentenceCount <= 7) target = Math.ceil(sentenceCount * 0.72);
        else if (sentenceCount <= 12) target = Math.ceil(sentenceCount * 0.62);
        else target = Math.ceil(sentenceCount * 0.52);

        if (visibleLength > 900) target += 1;
        if (visibleLength > 1800) target += 1;
        return Math.max(0, Math.min(14, target) - Math.min(existing, target));
    }

    function confidenceFloor(sentenceCount) {
        // In a one-line input, always give the user a useful result.
        // In long prose, prefer stronger sentences and avoid decorating every line.
        if (sentenceCount <= 1) return 0;
        if (sentenceCount <= 3) return 4.5;
        if (sentenceCount <= 7) return 6;
        return 6.5;
    }

    function process(originalText) {
        if (typeof originalText !== 'string') throw new TypeError('Mojitap expects text.');

        const report = {
            text: originalText,
            added: 0,
            matchedSentences: 0,
            version: VERSION
        };
        if (!originalText.trim()) return report;

        const masked = maskProtected(originalText);
        const rawLines = originalText.split(/(\r\n|\r|\n)/);
        const cleanLines = masked.split(/(\r\n|\r|\n)/);

        const entries = [];
        let logicalSentence = 0;
        let paragraph = 0;

        rawLines.forEach((line, lineIndex) => {
            if (/^(?:\r\n|\r|\n)$/.test(line)) return;
            if (!line.trim()) {
                paragraph++;
                return;
            }
            if (/^\s*(?:#{1,6}\s|(?:const|let|var|import|export|function|class)\s|(?:\/\/|\/\*|\*\/))/.test(line)) return;
            const pieces = sentenceSlices(line, cleanLines[lineIndex] || '');
            pieces.forEach((piece, pieceIndex) => {
                const clean = piece.clean.trim();
                if (!clean || !WORD.test(clean)) return;
                entries.push({
                    lineIndex,
                    pieceIndex,
                    paragraph,
                    sentenceIndex: logicalSentence++,
                    raw: piece.raw,
                    clean,
                    existingEmoji: hasEmoji(piece.raw),
                    analyses: hasEmoji(piece.raw) ? [] : analyzeSentence(clean)
                });
            });
        });

        const eligible = entries.filter(e => !e.existingEmoji && e.analyses.length);
        const existing = emojiCount(originalText);
        EMOJI.lastIndex = 0;
        const visibleLength = masked.replace(EMOJI, '').replace(/\s/g, '').length;
        const wanted = targetCount(entries.length, visibleLength, existing);
        if (!wanted || !eligible.length) return report;

        const floor = confidenceFloor(entries.length);
        const ranked = eligible
            .map(e => ({ ...e, best: e.analyses[0] }))
            .sort((a, b) => {
                const aStrength = a.best.confidence + (a.best.group === 'status' ? 2 : 0);
                const bStrength = b.best.confidence + (b.best.group === 'status' ? 2 : 0);
                return bStrength - aStrength || a.sentenceIndex - b.sentenceIndex;
            });

        const chosen = [];
        const chosenIds = new Set();
        const familyUse = new Map();
        const paragraphUse = new Map();

        function canAdd(entry, allowDuplicateFamily) {
            if (chosenIds.has(entry.sentenceIndex)) return false;
            if (!allowDuplicateFamily && entries.length >= 5) {
                const count = familyUse.get(entry.best.id) || 0;
                const cap = entry.best.group === 'status' ? 2 : 1;
                if (count >= cap) return false;
            }
            return true;
        }

        function addEntry(entry) {
            chosen.push(entry);
            chosenIds.add(entry.sentenceIndex);
            familyUse.set(entry.best.id, (familyUse.get(entry.best.id) || 0) + 1);
            paragraphUse.set(entry.paragraph, (paragraphUse.get(entry.paragraph) || 0) + 1);
        }

        // First take strong, semantically distinct matches.
        for (const entry of ranked) {
            if (chosen.length >= wanted) break;
            if (entry.best.confidence < floor) continue;
            if (canAdd(entry, false)) addEntry(entry);
        }

        // Then fill coverage with distinct fallbacks so ordinary prose remains useful.
        for (const entry of ranked) {
            if (chosen.length >= wanted) break;
            if (canAdd(entry, false)) addEntry(entry);
        }

        // Prefer at least one useful suggestion in each non-empty paragraph when budget allows.
        const paragraphIds = [...new Set(entries.map(e => e.paragraph))];
        if (wanted >= paragraphIds.length) {
            for (const pid of paragraphIds) {
                if ((paragraphUse.get(pid) || 0) > 0 || chosen.length >= wanted) continue;
                const candidate = ranked.find(e => e.paragraph === pid && !chosenIds.has(e.sentenceIndex));
                if (candidate) addEntry(candidate);
            }
        }

        // Only if the budget is still not met, allow a repeated semantic family.
        for (const entry of ranked) {
            if (chosen.length >= wanted) break;
            if (canAdd(entry, true)) addEntry(entry);
        }

        const finalSelected = chosen
            .sort((a, b) => a.sentenceIndex - b.sentenceIndex)
            .slice(0, wanted);

        const selectedBySentence = new Map(finalSelected.map(e => [e.sentenceIndex, e]));
        const usedEmoji = new Map();
        const recent = [];

        let currentSentence = 0;
        const output = rawLines.map((line, lineIndex) => {
            if (/^(?:\r\n|\r|\n)$/.test(line) || !line.trim()) return line;
            if (/^\s*(?:#{1,6}\s|(?:const|let|var|import|export|function|class)\s|(?:\/\/|\/\*|\*\/))/.test(line)) return line;

            const pieces = sentenceSlices(line, cleanLines[lineIndex] || '');
            return pieces.map(piece => {
                const clean = piece.clean.trim();
                if (!clean || !WORD.test(clean)) return piece.raw;
                const idx = currentSentence++;
                const chosenEntry = selectedBySentence.get(idx);
                if (!chosenEntry || hasEmoji(piece.raw)) return piece.raw;

                const analysis = chosenEntry.best;
                const emoji = chooseEmoji(analysis.emojis, clean + analysis.id, recent, usedEmoji);
                if (!emoji) return piece.raw;

                const extras = [emoji];
                // For a single long sentence with two clearly different strong themes,
                // allow a second relevant emoji. Multi-sentence prose stays one per sentence.
                if (entries.length === 1 && clean.length >= 50 && chosenEntry.analyses.length > 1) {
                    const second = chosenEntry.analyses.find(candidate =>
                        candidate.id !== analysis.id &&
                        candidate.confidence >= 9 &&
                        !['status','generic'].includes(candidate.group)
                    );
                    if (second) {
                        const secondEmoji = chooseEmoji(second.emojis, clean + second.id, recent.concat(emoji), usedEmoji);
                        if (secondEmoji && secondEmoji !== emoji) extras.push(secondEmoji);
                    }
                }

                for (const addedEmoji of extras) {
                    usedEmoji.set(addedEmoji, (usedEmoji.get(addedEmoji) || 0) + 1);
                    recent.push(addedEmoji);
                    while (recent.length > 3) recent.shift();
                }
                report.added += extras.length;
                report.matchedSentences++;

                const trailing = piece.raw.match(/\s*$/)?.[0] || '';
                const core = piece.raw.slice(0, piece.raw.length - trailing.length);
                return core + ' ' + extras.join(' ') + trailing;
            }).join('');
        });

        report.text = output.join('');
        return report;
    }

    const engine = Object.freeze({
        version: VERSION,
        transform: text => process(text).text,
        analyze: process
    });

    root.smartEmojiEngine = engine;
    if (typeof module === 'object' && module.exports) module.exports = engine;
})(typeof globalThis !== 'undefined' ? globalThis : window);
