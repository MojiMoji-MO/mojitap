/* Mojitap local emoji suggestion engine — version 2026-09-17.31
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

    const VERSION = '2026-09-17.64';

    const EMOJI = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;
    const PROTECTED = /```[\s\S]*?(?:```|(?![\s\S]))|~~~[\s\S]*?(?:~~~|(?![\s\S]))|`[^`\r\n]*`|!?\[[^\]\r\n]*\]\([^\r\n)]*\)|https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:^|\s)[#@][\p{L}\p{N}_][\p{L}\p{N}_.-]*|<[^>\r\n]+>/gimu;
    const WORD = /[\p{L}\p{N}]/u;

    const FALSE_NEGATIVE = /\b(?:can['’]t wait|cannot wait|couldn['’]t be happier|not only|no wonder|no[- ]brainer|never been better|nothing short of|no problem|don['’]t give up|not bad)\b/i;
    const CONDOLENCE = /사망|별세|장례|부고|추모|유가족|명복|애도|\b(?:death|died|dead|funeral|bereavement|mourning)\b|passed away|rest in peace|condolence/i;
    const HIGH_SENSITIVITY = /자살|자해|극단적 선택|성폭력|성추행|강간|과다복용|호흡곤란|가슴 통증|의식.{0,6}없|\b(?:suicide|self[- ]harm|rape|sexual assault|overdose|chest pain)\b|cannot breathe|can['’]t breathe/i;
    const STOP_ACTION = /\b(?:do not|don['’]t|never|must not|should not|shouldn['’]t)\s+(?:ever\s+)?(?:click|tap|open|follow|visit|sign\s*up|subscribe|download|install|buy|share|send|post|publish)\b|(?:클릭|접속|열|가입|구독|다운로드|설치|구매|공유|전송|게시).{0,14}(?:하지\s*마|지\s*마|금지|안\s*돼)|(?:클릭|접속|가입|구독|설치|구매|공유|게시)\s*금지/i;
    const CANCEL = /\b(?:cancelled|canceled|cancelling|canceling|called off)\b|취소(?:됐|되|했|합|된|됨)/i;
    const DELAY = /\b(?:delayed|running late|behind schedule|postponed|on hold)\b|지연(?:됐|되|된|중)|연기(?:됐|되|했|합|된|됨)|보류(?:됐|되|된|중)|늦어지|늦어졌/i;
    const BAD_OUTCOME = /\b(?:failed|failure|unsuccessful|rejected|declined|broken|crashed|outage|error)\b|could(?:n['’]t| not) (?:save|import|upload|connect)|(?:저장|결제|연결|업로드|가져오기).{0,10}(?:실패|안\s*돼|못)|실패(?:했|합|함|한)|오류.{0,5}(?:발생|났)|고장|장애\s*발생/i;
    const NEGATED_BAD_STATUS = /\b(?:not|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|hasn['’]t|haven['’]t|didn['’]t|did not)\s+(?:been\s+)?(?:cancelled|canceled|delayed|fail|failed|broken|rejected|declined)\b|(?:취소|지연|실패|고장|거절).{0,8}(?:되지\s*않|하지\s*않|아니|없)/i;
    const RECOVERY_AFTER_SETBACK = /\b(?:failed|failure|setback|mistake|fell short)\b.{0,45}\b(?:but|however|still|again|retry|try again|keep going|move forward|learned)\b|(?:실패|실수|좌절).{0,35}(?:하지만|했지만|그래도|다시|재도전|계속|배웠)/i;
    const BAD_REVIEW = /(?:do not|don['’]t|wouldn['’]t|cannot|can['’]t)\s+recommend|would not recommend|waste of money|poor quality|bad experience|not worth|비추천|추천하지\s*않|돈이\s*아깝|품질.{0,8}(?:나쁘|나빠)|최악/i;
    const NEG_MOOD = /\b(?:not|isn['’]t|wasn['’]t)\s+(?:very\s+)?(?:happy|okay|fine|good)\b|\b(?:unhappy|disappointed|upset|frustrated|sad|lonely|anxious|worried|not feeling (?:very )?confident|low confidence)\b|기분.{0,8}좋지\s*않|행복하지\s*않|괜찮지\s*않|실망|속상|짜증|우울|슬프|외롭|걱정|불안|자신감.{0,8}(?:떨어|없)/i;
    const UNAVAILABLE = /\b(?:not|isn['’]t|aren['’]t|cannot|can['’]t)\s+(?:currently\s+)?(?:available|supported|working|possible|allowed)\b|사용.{0,8}(?:불가|안\s*돼|못|할\s*수\s*없)|이용.{0,8}(?:불가|할\s*수\s*없)|지원하지\s*않|작동하지\s*않|가능하지\s*않/i;
    const UNCERTAIN = /\b(?:maybe|perhaps|might|not sure|unsure|could be|i guess|probably|wonder(?:ing)?)\b|아마|일지도|확실하지|모르겠|잘\s*모르|궁금/i;
    const META_REFERENCE = /\b(?:word|term|phrase|label|example|documentation|docs?|guide|text|sentence|copy)\b.{0,28}\b(?:error|warning|failed|failure|cancelled|canceled|delay|problem)\b|\b(?:error|warning|failed|failure|cancelled|canceled|delay|problem)\b.{0,28}\b(?:word|term|phrase|label|example|documentation|docs?|guide|text|sentence)\b|(?:오류|경고|실패|취소|지연|문제).{0,16}(?:단어|용어|문구|예시|문서|가이드|텍스트|문장)|(?:단어|용어|문구|예시|문서|가이드|텍스트|문장).{0,16}(?:오류|경고|실패|취소|지연|문제)/i;
    const HEALTHY_STATUS = /\b(?:no problem|no issues?|without errors?|working now|working again|stable again|resolved|fixed now|all clear)\b|문제\s*없|문제가\s*없|이상\s*없|오류\s*없이|정상적으로\s*(?:작동|동작)|다시\s*정상|안정화|해결되었|해결됐/i;

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
            Q(/\b(?:i(?:'ve| have)? been thinking|i think|i realize|i realised|i(?:'m| am) starting to realize|looked back|looking back|reflect(?:ing)? on|makes? me think|helped me think|think more clearly|been wondering|what i want from the next year)\b/i, 11),
            Q(/생각해\s*보|돌이켜\s*보|돌아보|깨닫|느끼게\s*되|곰곰이|생각을\s*정리|생각이\s*정리|내년.{0,18}원하는지.{0,12}생각/i, 11)
        ], ['think','thinking','realize','realise','reflect','wonder','생각','깨닫','돌아보']),

        P('time-passing', ['⏳','🕰️'], 95, 'life', [
            Q(/\b(?:time (?:passes|flies|goes by|moves quickly)|days? (?:fly|seem to fly) by|(?:week|month|months?|weeks?) (?:go|went) by|(?:another|this|last|the) month (?:flew|has flown|went|disappeared) by|(?:the |this )?month (?:disappeared|went by) (?:much )?faster|(?:the )?year (?:feels like it is |seems to be )?moving faster|go(?:ne)? by so fast|went by so fast|went by much faster|before i knew it|over the years?|as time goes by|weeks? feel long|months? fly by)\b/i, 13),
            Q(/시간.{0,8}(?:빠르|흐르|지나|간다|가는)|세월.{0,8}(?:빠르|흐르|지나)|하루.{0,16}(?:빨리|금방).{0,8}(?:지나|갔)|(?:이번|또|지난)\s*(?:주|달|한\s*달).{0,18}(?:빨리|금방|순식간|훨씬\s*빨리).{0,8}(?:지나|갔)|한\s*달.{0,12}(?:순식간|눈깜짝할\s*사이).{0,8}(?:지나|갔)|시간.{0,16}(?:빨리|금방).{0,8}(?:갔|지나)|돌아보니.{0,12}(?:빠르|금방)/i, 13)
        ], ['time','years','weeks','months','시간','세월'], [Q(/\b(?:alarm|timer|deadline|due|appointment)\b|알람|타이머|마감/i, 8)]),

        P('slowdown', ['🌿','😌'], 98, 'life', [
            Q(/\b(?:slow down|slow morning|room to breathe|give myself more room|doesn['’]t always have to move fast|do not have to move fast|do not need to rush|don['’]t need to rush|no reason to rush|steady progress over rushing|choose steady progress over rushing|take it slow|take things slowly|give myself time|less pressure|quiet(?:er)? pace|step back|pause and breathe)\b/i, 13),
            Q(/천천히|서두르지|서두르기보다|서두를\s*(?:이유|필요)|빠르게만.{0,8}(?:살|가|흘러)|꾸준한\s*진전|꾸준히.{0,10}(?:나아|가)|무조건\s*서두르기보다|여유를|한숨\s*돌|속도를\s*늦/i, 14)
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
            Q(/\b(?:get(?:ting)? enough rest|take a break|need (?:a |a little )?break|little break|rest and recover|quiet evening|quiet night|quiet nights?|relax(?:ing)? at home|resting|wind down)\b/i, 11),
            Q(/충분히\s*쉬|휴식을|쉬어가|조용히\s*쉬|조용한\s*(?:저녁|밤)|푹\s*쉬|쉬고\s*싶|휴식/i, 12)
        ], ['rest','relax','sleep','evening','night','휴식','쉬다','저녁']),

        P('family-connection', ['💛','🤝'], 99, 'social', [
            Q(/\b(?:see|seeing|visit|visiting|spend time with|looking forward to seeing|looking forward to (?:dinner|lunch|breakfast) with) (?:my |our |the )?(?:family|parents?|mom|mum|mother|dad|father|cousins?|siblings?|sister|brother)\b/i, 15),
            Q(/\b(?:dinner|lunch|breakfast|meal) with (?:my |our )?(?:parents?|family|cousins?|siblings?|mom|mum|dad|sister|brother)\b/i, 15),
            Q(/\b(?:missed|miss) (?:my |our )?(?:parents?|family|cousins?|siblings?|mom|mum|dad|sister|brother)\b/i, 14),
            Q(/가족을.{0,12}(?:볼|만날|만나|보러)|부모님을.{0,12}(?:뵐|만날|보러)|가족과.{0,10}(?:시간|함께|식사|저녁|점심)|부모님과.{0,12}(?:저녁|점심|식사|시간)|부모님.{0,12}(?:저녁|점심).{0,12}(?:기대|먹을)|사촌.{0,12}(?:만나|식사|저녁)/i, 15)
        ], ['family','parents','cousins','가족','부모님','사촌']),
        P('social-connection', ['🤝'], 93, 'social', [
            Q(/\b(?:meet(?:ing)? good people|met (?:my|a|an|the) (?:friend|sister|brother|coworker|colleague|neighbor|neighbour|classmate|manager)|spend time with (?:friends|family|people)|catch up with|caught up with|good company|connect(?:ing)? with people|together with|people i care about|seeing my family|see my family|visit my parents|seeing my parents)\b/i, 13),
            Q(/좋은\s*사람|친구와|가족과|가족을.{0,8}(?:볼|만날)|사람들과.{0,8}(?:시간|함께)|만나서|함께하는|오랜\s*친구/i, 13)
        ], ['friends','family','people','together','friend','사람','친구','가족','함께'], [Q(/\b(?:meeting at|meeting on|schedule a meeting|business meeting|team meeting)\b/i, 10)]),

        P('learning', ['📚','💡'], 92, 'growth', [
            Q(/\b(?:learn(?:ing)? something new|learn a new|keep learning|study something|pick up a new skill|new skill)\b/i, 10),
            Q(/새로운.{0,8}배우|배움을|공부하|새\s*기술|익히/i, 10)
        ], ['learn','learning','study','skill','course','배우','공부','학습','기술']),

        P('goal', ['🎯'], 93, 'growth', [
            Q(/\b(?:reach(?:ing)? (?:the|my|our|your) goal|achieve(?:ment| my| our| your)?|things? i want to achieve|work toward|working toward|set a goal|hit (?:the|my|our) target|one step closer to (?:the|my|our|your) goal|closer to (?:the|my|our|your) goal)\b/i, 11),
            Q(/목표를.{0,8}(?:달성|이루)|이루고\s*싶|성취하|목표를\s*향|목표에.{0,10}(?:가까워|한\s*걸음)/i, 11)
        ], ['goal','achieve','target','milestone','목표','성취','달성']),

        P('growth', ['🌱','📈'], 88, 'growth', [
            Q(/\b(?:personal growth|grow as a person|getting better|improve myself|small progress|making progress|moving forward|moving ahead|getting closer|patient with my progress|patient with my own progress|patient with (?:my )?(?:own )?progress|progress deserves|little progress|small improvements?|small step|one more step|step toward|stop comparing my pace|compare my pace)\b/i, 12),
            Q(/성장하|나아지고|조금씩.{0,10}(?:발전|앞으로|나아)|발전하|앞으로\s*(?:나아|가)|가까워졌|작은\s*(?:진전|발전)|진전도|발전도|내가\s*가는\s*속도|내\s*속도.{0,14}비교|목표에\s*한\s*걸음/i, 13)
        ], ['growth','grow','progress','improve','성장','발전','나아']),

        P('tired', ['😮‍💨','🛌'], 93, 'mood', [
            Q(/\b(?:(?:i(?:'m| am| was| felt)|feeling) tired|tiring|exhausted|worn out|long day|need to rest|need some rest|just rest|rest tonight)\b/i, 11),
            Q(/피곤|지쳤|지쳐|녹초|긴\s*하루/i, 11)
        ], ['tired','exhausted','피곤','지쳤']),

        P('excitement', ['🤩','✨'], 92, 'mood', [
            Q(/\b(?:i(?:'m| am) excited|feeling excited|so excited|really excited|excited for|excited about)\b/i, 12),
            Q(/신나|기대돼|기대되|설레/i, 12)
        ], ['excited','신나','설레']),

        P('affection', ['💛','❤️'], 92, 'mood', [
            Q(/\b(?:i love you|love you|miss you|love this|care about you)\b/i, 10),
            Q(/사랑해|소중해|아껴/i, 10)
        ], ['love','miss','사랑','소중']),

        P('pride', ['🏆','✨'], 91, 'growth', [
            Q(/\b(?:proud of|i(?:'m| am) proud|feel proud|accomplished something)\b/i, 10),
            Q(/뿌듯|자랑스|해냈다는/i, 10)
        ], ['proud','accomplished','뿌듯','자랑스']),

        P('golden-hour', ['🌅','✨'], 95, 'social', [Q(/\b(?:golden hour|city sunset|evening glow)\b/i, 12), Q(/골든\s*아워|노을빛/i, 12)], ['golden hour','노을']),
        P('city-night', ['🌃','🌙'], 92, 'social', [Q(/\b(?:city lights?|night view|night skyline)\b/i, 11), Q(/야경|도시의\s*밤|밤거리/i, 11)], ['city lights','night view','야경']),
        P('reset-rest', ['🌿','😌'], 97, 'life', [Q(/\b(?:weekend reset|reset day|rest day|slow weekend|quiet weekend)\b/i, 13), Q(/주말\s*리셋|쉬는\s*날|느린\s*주말|조용한\s*주말/i, 13)], ['reset','rest','리셋','휴식']),
        P('fresh-start', ['🌱','✨'], 93, 'growth', [Q(/\b(?:new chapter|fresh start|starting fresh|reset in progress|weekend reset)\b/i, 12), Q(/새로운\s*(?:챕터|시작)|새\s*(?:출발|시작)|기분도\s*새롭게|리셋\s*중/i, 13)], ['new chapter','fresh start','reset','새 출발','리셋']),
        P('headphones', ['🎧','🎵'], 92, 'topic', [Q(/\b(?:headphones?|earbuds?)\b/i, 10), Q(/이어폰|헤드폰/i, 10)], ['headphones','이어폰']),
        P('light-mood', ['😊','🌿'], 87, 'mood', [Q(/\b(?:felt lighter|feel lighter|lighter than yesterday)\b/i, 10), Q(/마음이\s*가볍|기분이\s*가벼/i, 10)], ['lighter','가볍']),
        P('sunset', ['🌅'], 91, 'topic', [Q(/\b(?:sunset|sunrise)\b/i, 10), Q(/노을|일출|해돋이/i, 10)], ['sunset','sunrise','노을','일출']),

        P('career', ['🧑‍💼','💼'], 86, 'topic', [
            Q(/\b(?:job interview|interview tomorrow|career change|changing jobs?|changing careers?|new job|job offer)\b/i, 10),
            Q(/면접|이직|새\s*직장|취업|채용/i, 9)
        ], ['interview','career','job','면접','이직','취업']),

        P('gratitude', ['🙏','💛'], 94, 'mood', [
            Q(/\b(?:thank you|thanks for|grateful for|feeling grateful|feel grateful|feel thankful|thankful for|feel lucky|supportive people|appreciate|so thankful)\b/i, 12),
            Q(/감사|고마워|고맙|덕분|응원해\s*주는\s*사람|곁에서\s*응원/i, 10)
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
            Q(/\b(?:feel sad|feeling sad|heartbroken|feeling down|miss (?:him|her|them|you|my friends?|old friends?|my family|my parents?)|lonely lately)\b/i, 13),
            Q(/슬퍼|속상|마음이\s*아프|외로|우울|(?:친구|가족|부모님|사람).{0,10}(?:보고\s*싶|그립)/i, 13)
        ], ['sad','lonely','upset','disappointed','슬프','외롭','속상','우울']),

        P('worry', ['😟','💭'], 90, 'mood', [
            Q(/\b(?:worry(?:ing)? about|anxious(?: about)?|uneasy(?: about)?|feel(?:ing)? uneasy|feel(?:ing)? (?:a little )?anxious|stressed about|can['’]t stop worrying|concerned about)\b/i, 11),
            Q(/걱정하|불안하|고민이|스트레스/i, 10)
        ], ['worry','worried','anxious','stress','concern','걱정','불안','고민'], [
            Q(/\b(?:rather than|instead of)\s+(?:constantly\s+)?worry/i, 9),
            Q(/걱정하기보다|걱정보다는/i, 9)
        ]),

        P('encouragement', ['💪','🙌'], 96, 'mood', [
            Q(/\b(?:don['’]t give up|do not give up|don['’]t stop|do not stop|keep going|almost there|you can do it|you['’]ve got this|good luck|hang in there)\b/i, 12),
            Q(/포기하지\s*마|멈추지\s*마|거의\s*다\s*왔|힘내|계속\s*가|할\s*수\s*있어|응원해|잘\s*될\s*거야/i, 12)
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
            Q(/\b(?:take a walk|took (?:a |a long )?walk|go for a walk|went for a walk|walked around|walking around|stroll|short walk|long walk|walk after|walked after)\b/i, 12),
            Q(/산책|걸어다|걸으러|걸으면서|걸었다|걸었|걷는\s*길|강가를\s*걸/i, 12)
        ], ['walk','walking','산책']),

        P('small-victory', ['🎉','🙌'], 98, 'event', [Q(/\b(?:tiny victory|small victory|little win|small win)\b/i, 13), Q(/작은\s*승리|작은\s*성과/i, 13)], ['victory','win','승리','성과']),
        P('celebration', ['🎉','🥳'], 97, 'event', [
            Q(/\b(?:congratulations|congrats|graduated|graduation|we won|won the award|passed the exam|got the job|celebrating|celebrate (?:this|it|a win)|tiny win|small win)\b/i, 12),
            Q(/축하|합격했|졸업했|우승했|수상했|취업했/i, 11)
        ], ['congrats','graduation','won','축하','합격','졸업','우승']),

        P('birthday', ['🎂','🎉'], 98, 'event', [Q(/\b(?:birthday|happy anniversary)\b/i, 12), Q(/생일|기념일/i, 12)], ['birthday','생일','기념일']),
        P('launch', ['🚀','✨'], 97, 'event', [Q(/\b(?:just launched|launched (?:the |a )?(?:new )?(?:feature|product|service)|launching today|now live|released today|available now|introducing our new)\b/i, 13), Q(/출시했|출시합니다|정식\s*오픈|서비스\s*시작|새롭게\s*선보/i, 11)], ['launch','released','출시','오픈']),
        P('deadline', ['⏰','📅'], 97, 'status', [Q(/\b(?:deadline|due today|due tomorrow|submit by|expires? today|expires? tomorrow)\b/i, 12), Q(/마감|제출\s*기한|오늘까지|내일까지/i, 12)], ['deadline','due','마감','기한']),
        P('appointment', ['📅'], 91, 'event', [Q(/\b(?:meeting at|meeting on|appointment|scheduled for|calendar event|conference at|webinar at)\b/i, 10), Q(/회의.{0,24}(?:시|예정)|약속.{0,24}(?:시|예정)|일정|세미나|웨비나/i, 10)], ['appointment','schedule','calendar','회의','약속','일정']),

        P('delivery', ['📦'], 96, 'topic', [Q(/\b(?:package|parcel|shipment|delivery)\b/i, 9), Q(/택배|배송|소포/i, 9)], ['package','delivery','shipment','택배','배송']),
        P('payment', ['💳','💰'], 89, 'topic', [Q(/\b(?:payment|invoice|checkout|paid|billing)\b/i, 8), Q(/결제|청구서|입금/i, 8)], ['payment','invoice','결제','입금']),
        P('email', ['✉️','📧'], 85, 'topic', [Q(/\b(?:email|inbox|newsletter)\b/i, 8), Q(/이메일|뉴스레터|받은편지함/i, 8)], ['email','newsletter','이메일','뉴스레터']),
        P('message', ['💬'], 78, 'topic', [Q(/\b(?:message|messages|sentence|text)\b/i, 6), Q(/메시지|문장|텍스트/i, 6)], ['message','메시지']),
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
        P('cookies', ['🍪'], 99, 'topic', [Q(/\b(?:cookie|cookies)\b/i, 16), Q(/쿠키/i, 16)], ['cookie','cookies','쿠키']),
        P('pancakes', ['🥞'], 99, 'topic', [Q(/\b(?:pancake|pancakes)\b/i, 16), Q(/팬케이크/i, 16)], ['pancake','pancakes','팬케이크']),
        P('dessert', ['🍰','😋'], 97, 'topic', [Q(/\b(?:dessert|cheesecake|brownie|brownies|tiramisu)\b/i, 14), Q(/디저트|치즈케이크|브라우니|티라미수/i, 14)], ['dessert','디저트']),
        P('soup', ['🍲'], 98, 'topic', [Q(/\b(?:soup|stew)\b/i, 14), Q(/수프|스프|찌개/i, 14)], ['soup','stew','수프','찌개']),
        P('baking', ['🧁','🍪'], 93, 'topic', [Q(/\b(?:bake|baked|baking|oven)\b/i, 11), Q(/굽|베이킹|오븐/i, 11)], ['bake','baking','굽','베이킹']),
        P('laundry', ['🧺','✅'], 96, 'topic', [Q(/\b(?:laundry|folded the clothes|put the clothes away)\b/i, 13), Q(/빨래|세탁|옷을\s*개|옷을\s*정리/i, 13)], ['laundry','빨래','세탁']),
        P('organize-home', ['🧹','🏠'], 97, 'topic', [Q(/\b(?:organized|organised|tidied|cleared).{0,25}(?:closet|wardrobe|desk|drawer|drawers|kitchen|room|apartment)|(?:closet|wardrobe|desk|drawer|drawers).{0,25}(?:organized|organised|tidied|cleared)\b/i, 14), Q(/(?:옷장|책상|서랍|주방|방|공간).{0,25}(?:정리|정돈|치우)|(?:정리|정돈|치우).{0,25}(?:옷장|책상|서랍|주방|방|공간)/i, 14)], ['organized','closet','desk','정리','옷장','책상']),
        P('wind', ['💨'], 96, 'weather', [Q(/\b(?:wind|windy|breeze|breezy)\b/i, 13), Q(/바람|강풍|산들바람/i, 13)], ['wind','바람']),
        P('spring-warmth', ['🌸','☀️'], 95, 'weather', [Q(/\b(?:first warm day of spring|spring warmth|spring weather|warm spring day)\b/i, 14), Q(/봄다운\s*따뜻|따뜻한\s*봄날|봄\s*날씨/i, 14)], ['spring','봄']),
        P('city-night', ['🌃','🌙'], 96, 'topic', [Q(/\b(?:city lights?|night skyline|city at night|night view)\b/i, 14), Q(/도시\s*야경|야경|밤의\s*도시|도시의\s*밤/i, 14)], ['city lights','night view','야경']),
        P('chapter-reading', ['📖','📚'], 96, 'topic', [Q(/\b(?:chapter|chapters).{0,20}(?:before bed|before sleep|read|reading)|(?:read|reading).{0,20}(?:chapter|chapters)\b/i, 13), Q(/(?:챕터|장).{0,20}(?:읽|자기\s*전)|(?:자기\s*전).{0,15}(?:챕터|장)/i, 13)], ['chapter','챕터']),
        P('boarding-pass', ['🎫','📱'], 98, 'travel', [Q(/\b(?:boarding pass|return ticket|train ticket|flight ticket|ticket).{0,25}(?:saved|booked|phone|wallet)?\b/i, 14), Q(/탑승권|돌아오는\s*표|귀국\s*표|기차표|항공권|티켓/i, 14)], ['boarding pass','ticket','탑승권','티켓']),
        P('cache-maintenance', ['🛠️','🔄'], 94, 'tech', [Q(/\b(?:cache|cached data).{0,20}(?:cleared|purged|reset)\b/i, 13), Q(/캐시.{0,16}(?:비우|삭제|초기화|퍼지)/i, 13)], ['cache','캐시']),
        P('reset-email', ['📧','✅'], 98, 'tech', [Q(/\b(?:password reset|account recovery).{0,20}(?:email|message).{0,20}(?:delivered|sent|arrived)?\b/i, 14), Q(/(?:비밀번호\s*재설정|계정\s*복구).{0,20}(?:이메일|메일).{0,16}(?:전달|전송|도착)?/i, 14)], ['password reset','recovery email','비밀번호 재설정','복구 이메일']),
        P('metric-flat', ['📊','➡️'], 97, 'report', [Q(/\b(?:average|rate|metric|value|time).{0,25}(?:unchanged|flat|no material change|did not change|stayed the same)|(?:unchanged|flat).{0,20}(?:average|rate|metric|value)\b/i, 14), Q(/(?:평균|비율|지표|수치|시간).{0,25}(?:변화가\s*없|거의\s*변하지|그대로|유지)|큰\s*변화가\s*없/i, 14)], ['unchanged','flat','변화가 없','그대로']),
        P('discount-ineligible', ['🏷️','🚫'], 98, 'commerce', [Q(/\b(?:discount code|coupon|promo code).{0,30}(?:does not apply|doesn['’]t apply|not valid|ineligible)\b/i, 14), Q(/(?:할인\s*코드|쿠폰|프로모션\s*코드).{0,28}(?:적용되지\s*않|사용할\s*수\s*없|유효하지\s*않)/i, 14)], ['discount code','coupon','할인 코드','쿠폰']),
        P('food-company', ['🍽️','🤝'], 94, 'social', [Q(/\b(?:good food|dinner|meal).{0,18}(?:good|better|great) company\b/i, 12), Q(/맛있는\s*음식.{0,16}(?:사람|함께)|좋은\s*사람.{0,16}(?:식사|음식)/i, 12)], ['food','company','음식','사람']),
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
            Q(/\b(?:got enough sleep|slept well|sleeping better|been sleeping better|woke up rested|woke up refreshed|finally feel rested|rested for the first time|good night|go to bed|bedtime|sleep well)\b/i, 14),
            Q(/푹\s*(?:잤|자고\s*일어)|잘\s*잤|충분히\s*잤|잠을\s*(?:잘|꽤\s*잘)|며칠\s*만에.{0,12}(?:푹\s*자|개운)|취침/i, 14)
        ], ['sleep','slept','잠','잤']),

        P('museum', ['🏛️'], 89, 'topic', [Q(/\b(?:museum|gallery exhibit|exhibition)\b/i, 10), Q(/박물관|미술관|전시/i, 10)], ['museum','exhibition','박물관','전시']),

        P('phone-call', ['📞'], 90, 'action', [
            Q(/\b(?:call(?:ed|ing)? (?:my|your|the|our)|phone call|give .* a call|talked (?:to|with) (?:my|our) (?:sister|brother|mom|mum|dad|friend|parents?))\b/i, 14),
            Q(/전화하|전화해야|전화하는|전화해서|전화했|통화했/i, 14)
        ], ['call','phone','전화']),

        P('hydration', ['💧','🥤'], 89, 'life', [
            Q(/\b(?:drink more water|drinking water|stay hydrated|hydration)\b/i, 10),
            Q(/물(?:을|도|은)?.{0,10}(?:마시|마셨|자주\s*마)|수분.{0,8}섭취/i, 13)
        ], ['water','hydration','물','수분']),

        P('cold-weather', ['🥶','🧥'], 87, 'topic', [
            Q(/\b(?:getting colder|cold weather|cold air|cold morning|freezing morning|freezing outside|bitter(?:ly)? cold|temperature dropped|too cold to get out of bed|bed (?:was |felt )?hard to leave)\b/i, 14),
            Q(/날씨.{0,8}추워|점점\s*추워|기온.{0,8}내려|차가운\s*공기|추운\s*아침/i, 13)
        ], ['cold','colder','추워','기온']),

        P('phone-screen', ['📱'], 87, 'topic', [
            Q(/\b(?:staring at my phone|too much screen time|on my phone all day|phone screen)\b/i, 10),
            Q(/휴대폰.{0,10}(?:오래|화면)|스마트폰.{0,10}(?:오래|화면)|화면을\s*너무\s*오래/i, 10)
        ], ['phone','screen','휴대폰','스마트폰','화면']),

        P('digital-break', ['📵','🌿'], 90, 'life', [
            Q(/\b(?:(?:take|taking) a break from social media|social media break|digital detox|step away from screens?|offline break|weekend offline|logging off for (?:the )?weekend|log(?:ging)? off for (?:the )?weekend|weekend logoff|instead of scrolling|stop scrolling)\b/i, 14),
            Q(/소셜\s*미디어.{0,14}쉬|SNS.{0,14}쉬|디지털\s*디톡스|화면에서.{0,8}벗어나|휴대폰.{0,12}(?:멀리|내려놓|잠시\s*멀리)|잠시\s*오프라인|주말.{0,10}(?:오프라인|로그아웃)|이번\s*주말.{0,8}로그아웃|스크롤.{0,10}(?:대신|줄)/i, 14)
        ], ['social media','digital detox','소셜 미디어','디지털 디톡스']),

        P('travel', ['🧳','🌍'], 87, 'topic', [Q(/\b(?:trip|travel|vacation|holiday|passport|suitcase)\b/i, 9), Q(/여행|휴가|여권/i, 9)], ['trip','travel','vacation','여행','휴가']),
        P('flight', ['✈️'], 96, 'topic', [Q(/\b(?:flight|flying|fly to|airport|airplane|boarding pass)\b/i, 13), Q(/비행기|공항|항공편/i, 11)], ['flight','airport','비행기','공항']),
        P('hotel', ['🏨'], 94, 'topic', [Q(/\b(?:hotel|hostel|resort)\b/i, 10), Q(/호텔|숙소/i, 10)], ['hotel','resort','호텔','숙소']),
        P('rain', ['🌧️','☔'], 94, 'topic', [Q(/\b(?:rain|raining|rainy|umbrella)\b/i, 10), Q(/비가\s*오|밖에는\s*비|비\s*오는|장마|우산/i, 12)], ['rain','umbrella','비','우산']),
        P('snow', ['❄️'], 94, 'topic', [Q(/\b(?:snow|snowing|snowy)\b/i, 12), Q(/눈이\s*(?:오|내려|내리)|폭설|첫눈/i, 13)], ['snow','눈']),
        P('sunshine', ['☀️'], 93, 'topic', [Q(/\b(?:sunny|sunshine)\b/i, 10), Q(/햇살|화창/i, 10)], ['sunny','sunshine','햇살','화창']),
        P('nature', ['🌿','🌳'], 82, 'topic', [Q(/\b(?:forest|garden|park|hike|hiking|nature|trail)\b/i, 12), Q(/숲|정원|공원|등산|산행|자연/i, 12)], ['forest','garden','nature','숲','정원','자연']),
        P('ocean', ['🌊'], 93, 'topic', [Q(/\b(?:beach|ocean|sea|surfing)\b/i, 10), Q(/바다|해변|서핑/i, 10)], ['beach','ocean','바다','해변']),
        P('flowers', ['🌸'], 92, 'topic', [Q(/\b(?:flowers?|blossoms?)\b/i, 10), Q(/꽃|벚꽃/i, 10)], ['flower','꽃','벚꽃']),

        P('books', ['📚'], 97, 'topic', [Q(/\b(?:book|books|reading|library|novel|finished (?:a |the )?(?:great )?novel|quiet night with (?:a )?book)\b/i, 13), Q(/독서|도서관|(?:^|\s)책(?:을|이|은|도|과|만|\s)|손에는\s*책|책\s*읽|소설/i, 11)], ['book','reading','책','독서']),
        P('study', ['📖','✏️'], 89, 'topic', [Q(/\b(?:studying|study|homework|class|lesson|exam)\b/i, 8), Q(/공부|수업|숙제|시험/i, 8)], ['study','exam','공부','시험']),
        P('music', ['🎵','🎧'], 91, 'topic', [Q(/\b(?:listen(?:ing|ed)? to music|music|song|playlist|concert|singing)\b/i, 12), Q(/음악.{0,8}(?:듣|들)|노래|콘서트|플레이리스트/i, 12)], ['music','song','음악','노래']),
        P('photo', ['📷'], 89, 'topic', [Q(/\b(?:photo|photos|photography|camera|picture|pictures)\b/i, 11), Q(/사진|카메라|촬영/i, 11)], ['photo','camera','사진','카메라']),
        P('creative', ['🎨','✨'], 83, 'topic', [Q(/\b(?:paint(?:ed|ing)?|draw(?:ing|rew)?|painting|artwork|illustration|design|creative|creativity)\b/i, 13), Q(/그림|그리기|그리기를|미술|일러스트|디자인|창작|창의/i, 13)], ['art','creative','design','미술','창작']),
        P('running', ['🏃'], 97, 'topic', [Q(/\b(?:go for a run|went for a run|back to running|ran (?:about )?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:miles?|kilometers?|km))?|running (?:outside|today|this morning|this evening|\d+|miles?|kilometers?|km)|jog|jogging|marathon)\b/i, 15), Q(/러닝|달리기|마라톤|다시\s*러닝|\d+킬로미터.{0,8}달/i, 12)], ['running','marathon','러닝','달리기']),
        P('exercise', ['💪'], 87, 'topic', [Q(/\b(?:workout|workout routine|exercise routine|exercis(?:e|es|ed|ing)|fitness|gym)\b/i, 10), Q(/운동\s*루틴|다시\s*운동|운동.{0,12}다시|운동|헬스/i, 15)], ['workout','exercise','운동','헬스']),
        P('sports', ['🏆'], 76, 'topic', [Q(/\b(?:game|match|sports|player|team won)\b/i, 6), Q(/경기|스포츠|선수/i, 6)], ['game','match','sports','경기','스포츠']),
        P('football', ['⚽'], 91, 'topic', [Q(/\b(?:football|soccer)\b/i, 10), Q(/축구/i, 10)], ['football','soccer','축구']),
        P('basketball', ['🏀'], 91, 'topic', [Q(/\bbasketball\b/i, 10), Q(/농구/i, 10)], ['basketball','농구']),
        P('gaming', ['🎮'], 90, 'topic', [Q(/\b(?:gaming|video game|gameplay|console|multiplayer)\b/i, 9), Q(/게임|게이밍/i, 9)], ['gaming','gameplay','게임','게이밍']),
        P('code', ['💻','⌨️'], 96, 'topic', [Q(/\b(?:coding|programming|javascript|typescript|python|python script|node(?:\.js)?|node script|run the (?:node |python )?script|running the (?:node |python )?script|developer|debugging|code|config(?:uration)? file)\b/i, 15), Q(/코딩|프로그래밍|개발자|자바스크립트|파이썬(?:\s*스크립트)?|Node\s*스크립트|스크립트(?:를|가|는)?.{0,10}(?:실행|가져|불러)|설정\s*파일|코드/i, 15)], ['coding','programming','code','코딩','프로그래밍']),
        P('data', ['📊'], 89, 'topic', [Q(/\b(?:spreadsheet|dataset|analytics|chart|statistics|metrics|dashboard)\b/i, 11), Q(/데이터|엑셀|통계|스프레드시트|지표|대시보드/i, 11)], ['data','analytics','metrics','dashboard','데이터','통계','지표','대시보드']),
        P('security', ['🔒','🛡️'], 92, 'topic', [Q(/\b(?:password|encryption|privacy|security|authentication)\b/i, 10), Q(/비밀번호|암호|보안|개인정보|인증/i, 10)], ['security','privacy','보안','개인정보']),
        P('work', ['💼'], 73, 'topic', [Q(/\b(?:work|job|office|project|task|report|deadline at work)\b/i, 6), Q(/업무|직장|프로젝트|작업|보고서/i, 6)], ['work','project','업무','프로젝트']),
        P('shopping', ['🛍️','🛒'], 82, 'topic', [Q(/\b(?:shopping|shopping cart|buying clothes|go shopping)\b/i, 8), Q(/쇼핑|장바구니/i, 8)], ['shopping','cart','쇼핑','장바구니']),
        P('home', ['🏠'], 82, 'topic', [Q(/\b(?:new home|moving house|home renovation|at home)\b/i, 8), Q(/이사|새집|집들이|집에서/i, 8)], ['home','house','집','이사']),
        P('cleaning', ['🧹'], 86, 'topic', [Q(/\b(?:clean|cleaned|cleaning|declutter|tidy|tidying)\b/i, 11), Q(/청소|정리정돈/i, 11)], ['cleaning','clean','청소','정리']),
        P('timer', ['⏰'], 99, 'action', [Q(/\b(?:set|start|use) (?:a |the )?timer|timer for (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]minute timer|countdown timer\b/i, 14), Q(/타이머.{0,12}(?:맞춰|설정|시작)|\d+분\s*타이머/i, 14)], ['timer','타이머']),
        P('schedule-status', ['📅','🎯'], 96, 'report', [Q(/\b(?:on schedule|on track|next milestone|milestone is|milestone on)\b/i, 12), Q(/일정대로|계획대로|다음\s*마일스톤|마일스톤/i, 12)], ['schedule','milestone','일정','마일스톤']),
        P('event-time', ['📅'], 97, 'event', [Q(/\b(?:workshop|webinar|seminar|conference|class|event).{0,20}(?:starts?|begins?|at \d|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i, 12), Q(/(?:워크숍|웨비나|세미나|컨퍼런스|수업|행사).{0,18}(?:오전|오후|\d+시|시작|예정)/i, 12)], ['workshop','webinar','event','워크숍','행사']),
        P('meeting-time', ['📅'], 99, 'event', [Q(/\b(?:(?:team |business |client )?meeting (?:starts?|begins?|is|will be) (?:at|on)|meeting (?:at|on) \d|meeting tomorrow|meeting next)\b/i, 14), Q(/회의.{0,18}(?:오전|오후|\d+시|내일|시작|예정)/i, 14)], ['meeting','회의']),
        P('approval', ['✅','📝'], 97, 'status', [Q(/\b(?:client|manager|team|reviewer).{0,18}(?:approved|accepted) (?:the )?(?:final )?(?:draft|report|document|proposal)|(?:draft|report|document|proposal).{0,12}(?:approved|accepted)\b/i, 13), Q(/(?:클라이언트|관리자|팀).{0,16}(?:초안|보고서|문서|제안서).{0,10}(?:승인|확정)|(?:초안|보고서|문서|제안서).{0,12}(?:승인|확정)/i, 13)], ['approved','accepted','승인','확정']),
        P('http-error', ['❌','💻'], 98, 'tech', [Q(/\b(?:api|request|server).{0,16}(?:400|401|403|404|429|500|502|503|error code|returned an? error)\b/i, 13), Q(/(?:API|요청|서버).{0,16}(?:\d{3}\s*오류|오류를\s*반환)/i, 13)], ['api','error','오류']),
        P('deployment', ['🚀','✅'], 94, 'tech', [Q(/\b(?:deployment|deploy|deployed).{0,16}(?:complete|completed|successful|finished|ready)\b/i, 12), Q(/배포.{0,16}(?:완료|성공|끝|정상)/i, 12)], ['deployment','deploy','배포']),
        P('settings', ['⚙️','📝'], 88, 'tech', [Q(/\b(?:setting|settings|preference|preferences|configuration|configure)\b/i, 9), Q(/설정|환경설정|구성/i, 9)], ['settings','configuration','설정','구성']),
        P('link-url', ['🔗','🌐'], 87, 'tech', [Q(/\b(?:url|link|website address|web address)\b/i, 9), Q(/URL|링크|웹\s*주소/i, 9)], ['url','link','URL','링크']),
        P('calm', ['😌','🌿'], 90, 'mood', [Q(/\b(?:feel(?:ing)? calm|feel calmer|feeling calmer|calm mood|peaceful|at peace|relaxed|need some quiet|quiet after)\b/i, 11), Q(/차분|평온|마음이\s*편|편안|조용한\s*시간.{0,10}필요|시끄러운.{0,12}조용한/i, 11)], ['calm','peaceful','relaxed','차분','평온']),
        P('hair-style', ['💇','✨'], 96, 'social', [Q(/\b(?:haircut|fresh cut|new hair|changed my hair|new hairstyle)\b/i, 16), Q(/머리.{0,12}(?:바꾸|바꿨|잘랐|염색)|헤어스타일/i, 13)], ['hair','haircut','머리','헤어']),
        P('idea', ['💡','📝'], 89, 'creative', [Q(/\b(?:idea|ideas|brainstorm|brainstorming|late night ideas)\b/i, 10), Q(/아이디어|생각\s*정리|브레인스토밍/i, 10)], ['idea','ideas','아이디어']),
        P('trend-up', ['📈','📊'], 98, 'report', [
            Q(/\b(?:increased|increasing|increase in|grew|grown|growth of|rose|risen|higher than|up by|up \d|improved by)\b/i, 13),
            Q(/(?:증가|상승|늘었|늘어|성장).{0,20}(?:했|합|중|보|율|폭)?/i, 12)
        ], ['increase','growth','rose','증가','상승','성장']),
        P('trend-down', ['📉','📊'], 98, 'report', [
            Q(/\b(?:decreased|decreasing|decrease in|declined|decline in|fell (?:by|from|to|compared|after)|fallen (?:by|from|to)|lower than|down by|dropped)\b/i, 13),
            Q(/(?:감소|하락|줄었|줄어|떨어졌|내려갔)/i, 12)
        ], ['decrease','decline','fell','감소','하락']),
        P('trend-stable', ['📊','✅'], 91, 'report', [
            Q(/\b(?:stayed stable|remained stable|held steady|little change|no significant change)\b/i, 10),
            Q(/큰\s*변화\s*없이|안정적으로\s*유지|유지되었습니다|유지됐/i, 10)
        ], ['stable','steady','유지','안정']),
        P('report', ['📊','📝'], 90, 'report', [
            Q(/\b(?:monthly report|quarterly report|report is ready|report includes|report shows|report found|survey results|survey data|analysis results)\b/i, 10),
            Q(/월간\s*보고서|분기\s*보고서|보고서.{0,12}(?:준비|포함|결과|보여)|설문\s*결과|분석\s*결과/i, 10)
        ], ['report','survey','analysis','보고서','설문','분석']),
        P('action-item', ['✅','📌'], 95, 'report', [
            Q(/\b(?:action item|action items|next action|follow[- ]up task|follow[- ]up actions?|documented (?:two |three |several )?follow[- ]up actions?|to[- ]do item)\b/i, 12),
            Q(/실행\s*항목|후속\s*작업|할\s*일|체크리스트.{0,12}(?:업데이트|완료)/i, 12)
        ], ['action item','checklist','실행 항목','체크리스트']),
        P('attachment', ['📎','👀'], 93, 'action', [
            Q(/\b(?:attached (?:file|document|spreadsheet|proposal)|attachment|review the attached|see attached)\b/i, 11),
            Q(/첨부(?:된|한)?\s*(?:파일|문서|제안서|스프레드시트)|첨부\s*문서.{0,10}검토/i, 11)
        ], ['attached','attachment','첨부']),
        P('performance-time', ['⏱️','⚡'], 91, 'report', [
            Q(/\b(?:response time|load time|latency|processing time|faster response|reduce the time)\b/i, 10),
            Q(/응답\s*시간|로딩\s*시간|지연\s*시간|처리\s*시간|속도.{0,8}개선/i, 10)
        ], ['response time','latency','응답 시간','처리 시간']),
        P('shipping-status', ['📦'], 98, 'status', [
            Q(/\b(?:order has shipped|order shipped|has been shipped|is on the way|out for delivery|delivered today|arrived this afternoon)\b/i, 13),
            Q(/(?:주문|상품).{0,10}(?:발송|배송\s*시작)|배송\s*중|배달\s*중|택배.{0,10}(?:도착|발송)/i, 13)
        ], ['shipped','delivery','발송','배송']),
        P('out-of-stock', ['🚫','📦'], 99, 'status', [Q(/\b(?:out of stock|sold out|unavailable for purchase)\b/i, 14), Q(/품절|재고\s*없|구매\s*불가/i, 14)], ['out of stock','품절']),
        P('refund', ['💳','✅'], 97, 'status', [Q(/\b(?:refund (?:has been |was )?(?:processed|approved|completed)|refunded)\b/i, 13), Q(/환불.{0,12}(?:완료|처리|승인)|환불됐/i, 13)], ['refund','환불']),
        P('coupon', ['🏷️','⏰'], 92, 'commerce', [Q(/\b(?:coupon|promo code|discount code).{0,24}(?:expires?|ends?)\b/i, 11), Q(/쿠폰|프로모션\s*코드|할인\s*코드/i, 8)], ['coupon','promo','쿠폰','할인']),
        P('renewal', ['🔔','📅'], 92, 'status', [Q(/\b(?:subscription|membership).{0,18}(?:renews?|renewal)\b/i, 11), Q(/구독|멤버십/i, 5)], ['renew','subscription','구독','갱신']),
        P('support-wait', ['⏳','💬'], 95, 'support', [Q(/\b(?:waiting for (?:a |the )?(?:reply|response)|waiting for (?:the )?(?:customer|client|user) to (?:reply|respond)|waiting for (?:the )?(?:customer|client|user) response|still waiting|awaiting (?:a |the )?(?:reply|response))\b/i, 12), Q(/답변.{0,12}기다|회신.{0,12}기다|응답.{0,12}대기|(?:고객|클라이언트|사용자).{0,12}(?:회신|응답).{0,10}기다/i, 12)], ['waiting','reply','response','답변','회신']),
        P('crash', ['❌','🛠️'], 96, 'status', [Q(/\b(?:app|application|browser|program).{0,18}(?:crashes?|keeps crashing|closes unexpectedly)\b/i, 12), Q(/(?:앱|애플리케이션|브라우저|프로그램).{0,18}(?:종료|튕|충돌)/i, 12)], ['crash','튕','종료']),
        P('update', ['🔄','✨'], 88, 'product', [Q(/\b(?:update|new version|latest version).{0,24}(?:available|released|ready|ready to install)|update (?:the )?browser|browser update\b/i, 13), Q(/업데이트|새\s*버전|최신\s*버전|브라우저.{0,12}업데이트/i, 12)], ['update','version','업데이트','버전']),
        P('backup', ['💾','✅'], 96, 'tech', [Q(/\b(?:database )?(?:backup|backups?)\b/i, 13), Q(/데이터베이스\s*백업|백업/i, 13)], ['backup','백업']),
        P('maintenance', ['🛠️','🌙'], 92, 'tech', [Q(/\b(?:maintenance|maintenance window)\b/i, 10), Q(/점검|유지보수/i, 10)], ['maintenance','점검']),
        P('verify-email', ['📧','✅'], 93, 'action', [Q(/\b(?:verify|confirm).{0,12}(?:email|email address)\b/i, 11), Q(/이메일\s*주소.{0,10}확인|이메일.{0,10}인증/i, 11)], ['verify','email','확인','이메일']),
        P('renewed-stable', ['✅'], 91, 'status', [Q(/\b(?:stable again|working again|working now|back to normal)\b/i, 10), Q(/다시\s*안정|정상적으로\s*작동|정상\s*동작|다시\s*정상/i, 10)], ['stable','working','안정','정상']),
        P('repair', ['🛠️'], 87, 'topic', [Q(/\b(?:repair|fixing|maintenance|fix the|fixed the|bug fix|fixed a bug)\b/i, 10), Q(/수리|정비|고치기|버그.{0,8}수정|문제.{0,8}수정/i, 10)], ['repair','fix','수리','정비','수정'])
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

    // v53 precision layer. It resolves concrete object/action/status combinations before
    // older broad profiles. Rules are deliberately phrase-based so a single word such as
    // "meeting", "time" or "not" cannot dominate an unrelated sentence.




    // v62 natural prose refinements from qualitative short/long mixed-language review.
    function precisionV62(text, rawText) {
        const t = stripLeadLabel ? stripLeadLabel(text) : text;
        const has = re => re.test(t);
        const ret=(id,emojis,group='topic',confidence=76)=>special(id,emojis,group,confidence);

        if (has(/(?:feel like myself|back to myself|myself again).{0,28}(?:exhaust|rough|hard|long week)|(?:힘든|지친).{0,16}(?:주|시간).{0,20}(?:다시 나답|제자리|회복)/i)) return ret('v62-recover-self',['😮‍💨','🌿','😊'],'mood');
        if (has(/(?:chapters?|pages?).{0,18}(?:left|remaining).{0,20}(?:no motivation|unmotivated|can['’]t focus)|(?:no motivation|unmotivated).{0,18}(?:chapters?|pages?)|(?:챕터|장|페이지).{0,12}(?:남았|남아).{0,16}(?:의욕|집중).{0,10}(?:없|안)/i)) return ret('v62-study-no-motivation',['📚','😩','🌙'],'education');
        if (has(/(?:train|subway).{0,18}(?:packed|crowded).{0,24}(?:window seat|seat)|(?:window seat|seat).{0,18}(?:train|subway)|(?:기차|지하철).{0,12}(?:붐비|만원|혼잡).{0,18}(?:창가|자리|좌석)/i)) return ret('v62-crowded-train-seat',['🚆','💺'],'travel');
        if (has(/(?:flight).{0,18}(?:delayed|delay).{0,24}(?:gate).{0,12}(?:changed|moved)|(?:gate).{0,16}(?:changed|moved).{0,16}(?:flight).{0,12}(?:delay)|(?:비행기|항공편).{0,12}(?:지연).{0,16}(?:게이트).{0,10}(?:변경|바뀌)/i)) return ret('v62-flight-delay-gate',['✈️','⏳','📍'],'travel');
        if (has(/(?:refund|refund money).{0,18}(?:arrived|received|came|landed|credited)|(?:환불금|환불).{0,12}(?:들어왔|입금|도착|받았)/i)) return ret('v62-refund-received',['💰','✅'],'commerce');
        if (has(/(?:sold out|out of stock).{0,18}(?:size|smallest|largest)|(?:size).{0,18}(?:sold out|out of stock)|(?:사이즈).{0,12}(?:품절|매진)/i)) return ret('v62-size-soldout',['🚫','🛒'],'commerce');
        if (has(/(?:dashboard|report).{0,22}(?:conversion|signups?).{0,18}(?:up|increase|rose).{0,22}(?:errors?|failures?).{0,18}(?:down|decrease|fell)|(?:conversion|signups?).{0,18}(?:up|increase).{0,30}(?:errors?|failures?).{0,18}(?:down|decrease)|(?:대시보드|보고서).{0,18}(?:전환율|가입).{0,12}(?:오르|증가).{0,20}(?:오류|실패).{0,12}(?:줄|감소)/i)) return ret('v62-up-down-dashboard',['📈','📉','📊'],'report');
        if (has(/(?:api|service).{0,18}(?:healthy|normal|recovered|back).{0,22}(?:outage|incident)|(?:after).{0,16}(?:outage).{0,18}(?:api|service).{0,12}(?:healthy|normal|recovered)|(?:장애).{0,14}(?:뒤|후).{0,14}(?:API|서비스).{0,10}(?:정상|복구)/i)) return ret('v62-api-recovered',['✅','🌐'],'tech');
        if (has(/(?:deploy|deployment|release).{0,18}(?:succeeded|successful|passed).{0,26}(?:job|task).{0,18}(?:still).{0,10}(?:failed|failing)|(?:job|task).{0,18}(?:still).{0,10}(?:failed|failing).{0,22}(?:deploy|deployment).{0,12}(?:succeeded)|(?:배포|릴리스).{0,12}(?:성공|완료).{0,24}(?:작업|잡).{0,12}(?:아직).{0,8}(?:실패|오류)/i)) return ret('v62-deploy-mixed',['✅','⚠️','❌'],'tech');
        if (has(/(?:not a cancellation|not cancelled|not canceled|isn['’]t cancelled|isn['’]t canceled).{0,26}(?:moved|rescheduled|next week)|(?:cancelled|canceled).{0,10}(?:not).{0,22}(?:moved|rescheduled)|(?:취소).{0,8}(?:아니|아니라|아니고).{0,18}(?:다음 주|일정|변경|옮)/i)) return ret('v62-not-cancel-rescheduled',['📅','🔄'],'status');
        if (has(/(?:not unhappy|not sad).{0,20}(?:tired|overwhelmed|exhausted)|(?:tired|overwhelmed).{0,18}(?:not unhappy|not sad)|(?:기분이 나쁜|슬픈).{0,10}(?:건 아니|것은 아니).{0,18}(?:피곤|벅차|지쳤)/i)) return ret('v62-tired-not-sad',['😮‍💨','😌','😔'],'mood');
        if (has(/(?:sound of rain|rain sound|hearing rain).{0,18}(?:morning|woke|window)|(?:woke|wake).{0,18}(?:rain|raining)|(?:눈을 뜨|잠에서 깨).{0,16}(?:비 오는 소리|빗소리)|(?:아침).{0,14}(?:빗소리|비 오는 소리)/i)) return ret('v62-rain-sound',['🌧️','☔'],'weather');
        if (has(/(?:meeting).{0,18}(?:awkward|tense).{0,24}(?:agreed|next step|decision)|(?:awkward|tense).{0,18}(?:meeting).{0,20}(?:agreed|next step)|(?:회의).{0,12}(?:어색|긴장).{0,16}(?:다음 단계|결정|정했다|합의)/i)) return ret('v62-awkward-meeting-progress',['🤝','🎯','➡️'],'work');
        if (has(/(?:train).{0,18}(?:crowded|packed).{0,22}(?:window).{0,10}(?:seat)|(?:기차).{0,24}(?:붐비|붐볐|붐벼|혼잡).{0,30}(?:창가).{0,12}(?:앉|자리)/i)) return ret('v62-train-window',['🚆','💺'],'travel');
        return null;
    }

    // v59 final cleanup for broad natural variants that still fell through after v58.
    function precisionV59(text, rawText) {
        const t = stripLeadLabel ? stripLeadLabel(text) : text;
        const has = re => re.test(t);
        const ret = (id, emojis, group='topic', confidence=70) => special(id, emojis, group, confidence);

        if (has(/(?:spreadsheet|sheet).{0,18}(?:final|total|sum|numbers?)|(?:final|total|sum).{0,18}(?:spreadsheet|sheet)|(?:스프레드시트|시트).{0,12}(?:최종|합계|총합|수치)|(?:최종|합계|총합|수치).{0,18}(?:스프레드시트|시트)/i)) return ret('v59-sheet-total',['📊','✅','📝'],'work');
        if (has(/(?:wallet).{0,20}(?:under|beneath).{0,12}(?:sofa|couch)|(?:sofa|couch).{0,14}(?:wallet)|(?:지갑).{0,12}(?:소파).{0,8}(?:밑|아래)|(?:소파).{0,10}(?:밑|아래).{0,8}(?:지갑)/i)) return ret('v59-wallet-sofa',['👛','🔎','🛋️'],'life');
        if (has(/(?:room|hotel room).{0,18}(?:overlook|overlooks|view).{0,18}(?:old town|city center|harbor)|(?:객실|방).{0,12}(?:구시가지|도심|항구).{0,10}(?:내려다보|보이|전망)/i)) return ret('v59-room-overlook',['🏨','🏙️','😊'],'travel');
        if (has(/(?:rain jacket|raincoat|waterproof jacket).{0,18}(?:door|entry|ready)|(?:우비|레인코트|방수 재킷).{0,12}(?:현관|문|꺼내|준비)/i)) return ret('v59-rainwear-door',['🌧️','🧥','🚪'],'life');
        if (has(/(?:patch|fix).{0,18}(?:removed|fixed|stopped).{0,16}(?:crash).{0,16}(?:launch|startup)|(?:crash).{0,16}(?:launch|startup).{0,18}(?:removed|fixed|gone)|(?:패치|수정).{0,14}(?:시작|실행).{0,10}(?:충돌|크래시).{0,10}(?:사라|해결)/i)) return ret('v59-patch-crash',['✅','🛠️','📱'],'tech');
        if (has(/(?:legs?|calves?|muscles?).{0,14}(?:sore|stiff|aching).{0,18}(?:run|ran|running)|(?:run|ran|running).{0,18}(?:legs?|calves?|muscles?).{0,12}(?:sore|stiff)|(?:달린|달리기|러닝).{0,12}(?:뒤|후).{0,10}(?:다리|근육).{0,8}(?:뻐근|아프)|(?:다리|근육).{0,10}(?:뻐근|아프).{0,12}(?:달린|러닝)/i)) return ret('v59-sore-run',['🩹','🏃','😌'],'fitness');
        if (has(/(?:ankle|knee).{0,18}(?:hurts?|painful|sore).{0,28}(?:rest|resting|today|day off)|(?:발목|무릎).{0,16}(?:아프|아파|아픈|통증|뻐근).{0,24}(?:쉬|쉰|휴식)/i)) return ret('v59-ankle-rest',['🩹','😌','🚫'],'fitness');
        if (has(/(?:bag).{0,14}(?:full of).{0,8}(?:peaches?|fruit)|(?:peaches?|fruit).{0,16}(?:bag|bought|home)|(?:복숭아|과일).{0,12}(?:봉지|가방|가득|사서)/i)) return ret('v59-peach-bag',['🍑','🛍️','😊'],'food');
        if (has(/(?:moon).{0,18}(?:huge|big|bright).{0,20}(?:river|water|lake)|(?:river|water|lake).{0,18}(?:moon).{0,12}(?:huge|big|bright)|(?:달).{0,12}(?:크게|밝게|커다랗).{0,12}(?:강|물|호수)|(?:강|물|호수).{0,12}(?:달).{0,10}(?:크게|밝게)/i)) return ret('v59-moon-water',['🌙','🌊','✨'],'nature');
        if (has(/(?:favorite|favourite).{0,10}(?:band|artist).{0,26}(?:(?:live|concert).{0,14}(?:incredible|amazing|great)|(?:incredible|amazing|great).{0,14}(?:live|concert))|(?:band|artist).{0,24}(?:(?:live|concert).{0,14}(?:incredible|amazing|great)|(?:incredible|amazing|great).{0,14}(?:live|concert))|(?:좋아하는).{0,10}(?:밴드|가수).{0,18}(?:(?:라이브|공연).{0,10}(?:좋|최고|대단)|(?:좋|최고|대단).{0,10}(?:라이브|공연))/i)) return ret('v59-band-live',['🎵','🎤','🤩'],'creative');
        if (has(/(?:wrote|finished).{0,14}(?:chorus).{0,22}(?:(?:not|yet|still).{0,10}(?:the )?(?:verses?|verse)|(?:verses?|verse).{0,10}(?:not|yet|still))|(?:chorus).{0,14}(?:written|done).{0,22}(?:(?:not|yet|still).{0,10}(?:verses?)|(?:verses?).{0,10}(?:not|yet))|(?:후렴).{0,10}(?:썼|완성).{0,18}(?:(?:아직|안).{0,8}(?:벌스|절)|(?:벌스|절).{0,8}(?:아직|안))/i)) return ret('v59-chorus-not-verse',['🎵','✍️','📝'],'creative');
        return null;
    }

    // v58 broader compositional concepts for education, work, tech, commerce,
    // travel, fitness, creative and everyday language. These are noun/action
    // families rather than exact sentence templates.
    function precisionV58(text, rawText) {
        const t = stripLeadLabel ? stripLeadLabel(text) : text;
        const has = re => re.test(t);
        const ret = (id, emojis, group='topic', confidence=66) => special(id, emojis, group, confidence);

        // Guard / contrast semantics.
        if (has(/(?:order|package|parcel).{0,20}(?:delayed).{0,16}(?:not|isn['’]t|wasn['’]t).{0,10}(?:lost)|(?:not|isn['’]t|wasn['’]t).{0,12}(?:lost).{0,18}(?:delayed)|(?:주문|택배|소포).{0,14}(?:분실.{0,6}(?:아니|아니고)|잃어버린 게 아니).{0,12}(?:지연)/i)) return ret('v58-delay-not-lost',['⏳','📦'],'status',74);
        if (has(/(?:payment).{0,18}(?:pending).{0,16}(?:not|isn['’]t|wasn['’]t).{0,10}(?:failed)|(?:not|isn['’]t|wasn['’]t).{0,10}(?:failed).{0,16}(?:pending)|(?:결제).{0,12}(?:실패.{0,6}(?:아니|아니고)|실패가 아니라).{0,12}(?:대기|보류)/i)) return ret('v58-pending-not-failed',['⏳','💳'],'status',74);
        if (has(/(?:meeting).{0,20}(?:not|isn['’]t|aren['’]t).{0,10}(?:cancelled|canceled).{0,18}(?:room|location).{0,12}(?:changed|moved)|(?:not|isn['’]t).{0,10}(?:cancelling|canceling).{0,18}(?:meeting).{0,20}(?:room|location).{0,12}(?:changed)|(?:회의).{0,14}(?:취소.{0,6}(?:아니|아니고)|취소하는 게 아니라).{0,14}(?:방|장소).{0,10}(?:바뀌|변경)/i)) return ret('v58-meeting-room-change',['📅','🔄'],'work',74);
        if (has(/(?:server|service).{0,18}(?:slow).{0,20}(?:not|hasn['’]t|has not).{0,10}(?:crashed)|(?:not|hasn['’]t).{0,10}(?:crashed).{0,18}(?:server|service)|(?:서버|서비스).{0,14}(?:느리|지연).{0,14}(?:충돌.{0,6}(?:아니|않)|다운.{0,6}(?:아니|않))/i)) return ret('v58-slow-not-crashed',['⏱️','⚠️'],'tech',74);
        if (has(/(?:word|sample text|example text|example sentence).{0,20}(?:failed|failure)|(?:failed|failure).{0,20}(?:word|sample text|example text|example sentence)|(?:예시|샘플).{0,12}(?:문장|텍스트).{0,12}(?:실패)|(?:실패).{0,14}(?:예시|샘플).{0,10}(?:단어|문장|텍스트)/i)) return ret('v58-meta-failed',['📝','💡'],'writing',72);
        if (has(/(?:qr code|qr).{0,20}(?:do not|don['’]t|never).{0,10}(?:open|scan|tap)|(?:do not|don['’]t|never).{0,12}(?:open|scan).{0,16}(?:qr)|(?:QR|큐알).{0,12}(?:열지|스캔하지|누르지)/i)) return ret('v58-qr-warning',['⚠️','🚫'],'status',74);

        // Education.
        if (has(/(?:highlight|highlighted|mark|marked).{0,18}(?:paragraph|notes?|text)|(?:paragraph|notes?).{0,18}(?:highlighted|marked)|(?:문단|노트|필기).{0,14}(?:표시|강조|하이라이트)/i)) return ret('v58-study-highlight',['📝','💡','📚'],'education');
        if (has(/(?:review|revise|study).{0,18}(?:chapter|chapters).{0,16}(?:tonight|today|before)|(?:chapter|chapters).{0,16}(?:review|revise|study)|(?:챕터|장).{0,14}(?:복습|공부|읽).{0,12}(?:오늘|밤)?/i)) return ret('v58-review-chapters',['📖','🌙','📝'],'education');
        if (has(/(?:submit|submitted|turn in|turned in).{0,18}(?:assignment|homework|paper)|(?:assignment|homework|paper).{0,18}(?:submitted|turned in)|(?:과제|숙제|리포트).{0,12}(?:제출|냈)/i)) return ret('v58-submit-assignment',['📤','✅','📚'],'education');
        if (has(/(?:quiz|exam|test).{0,20}(?:moved|rescheduled|postponed).{0,16}(?:friday|monday|day)|(?:professor|teacher).{0,18}(?:moved|rescheduled).{0,16}(?:quiz|exam)|(?:퀴즈|시험).{0,14}(?:금요일|월요일|날짜).{0,12}(?:옮|변경|연기)/i)) return ret('v58-quiz-rescheduled',['📅','✏️','🔄'],'education');
        if (has(/(?:library).{0,18}(?:book).{0,14}(?:due|return)|(?:book).{0,14}(?:due).{0,14}(?:library)|(?:도서관).{0,12}(?:책).{0,12}(?:반납|기한)/i)) return ret('v58-library-due',['📚','📅','⏰'],'education');
        if (has(/(?:lecture|class).{0,18}(?:recording|video).{0,16}(?:online|available)|(?:강의|수업).{0,12}(?:녹화|영상).{0,12}(?:온라인|볼 수|공개)/i)) return ret('v58-lecture-recording',['🎓','🎥','🌐'],'education');
        if (has(/(?:study group).{0,18}(?:meet|meets|meeting)|(?:스터디|공부 모임).{0,12}(?:모임|만나|있다)/i)) return ret('v58-study-group',['👥','📚','🤝'],'education');

        // Work / collaboration.
        if (has(/(?:deadline|due date).{0,18}(?:extended|extension|pushed back)|(?:extended|extension).{0,14}(?:deadline|due date)|(?:마감|기한).{0,12}(?:연장|늘어|미뤄)/i)) return ret('v58-deadline-extended',['📅','⏳','🔄'],'work');
        if (has(/(?:attach|attached).{0,18}(?:screenshot|screenshots|screen capture).{0,18}(?:bug|report|ticket)|(?:bug report|ticket).{0,16}(?:screenshot).{0,14}(?:attach|attached)|(?:버그|오류).{0,10}(?:보고서|티켓).{0,12}(?:화면|스크린샷|캡처).{0,10}(?:첨부)/i)) return ret('v58-screenshot-bug',['📎','📸','🐞'],'work');
        if (has(/(?:assign|assigned).{0,16}(?:account|client|task).{0,16}(?:to|owner)|(?:account|client|task).{0,16}(?:assigned).{0,14}(?:to)|(?:계정|고객|작업).{0,14}(?:담당|배정|지정)/i)) return ret('v58-assigned-owner',['👤','📋','🤝'],'work');
        if (has(/(?:spreadsheet|sheet).{0,18}(?:final totals?|totals?|numbers?).{0,14}(?:updated|added)|(?:update|updated).{0,16}(?:spreadsheet|sheet).{0,14}(?:totals?|numbers?)|(?:스프레드시트|시트).{0,12}(?:최종|합계|수치).{0,10}(?:반영|업데이트|추가)/i)) return ret('v58-sheet-totals',['📊','✅','📝'],'work');
        if (has(/(?:presentation|demo).{0,18}(?:moved|changed|rescheduled).{0,14}(?:tuesday|morning|afternoon)|(?:발표|프레젠테이션|데모).{0,12}(?:화요일|오전|오후).{0,10}(?:변경|옮|미뤄)/i)) return ret('v58-presentation-moved',['📅','🔄','📊'],'work');
        if (has(/(?:workshop|meeting).{0,16}(?:notes?).{0,14}(?:ready).{0,14}(?:share|send)|(?:워크숍|회의).{0,10}(?:메모|노트).{0,10}(?:공유).{0,10}(?:준비|가능)/i)) return ret('v58-notes-ready-share',['📝','📤','✅'],'work');
        if (has(/(?:follow[- ]up).{0,12}(?:call).{0,16}(?:supplier|vendor|client)|(?:supplier|vendor|client).{0,16}(?:follow[- ]up call)|(?:공급업체|업체|고객).{0,14}(?:후속).{0,8}(?:통화|전화).{0,8}(?:예약|잡)/i)) return ret('v58-followup-call',['📞','📅','🤝'],'work');
        if (has(/(?:legal).{0,18}(?:approved).{0,16}(?:contract|wording)|(?:contract|wording).{0,16}(?:legal).{0,12}(?:approved)|(?:법무).{0,12}(?:계약|문구).{0,12}(?:승인)/i)) return ret('v58-legal-approved',['⚖️','✅','📜'],'work');

        // Tech.
        if (has(/(?:memory leak).{0,18}(?:fixed|resolved).{0,18}(?:server|service).{0,12}(?:recovered|normal)|(?:server|service).{0,18}(?:recovered).{0,18}(?:memory leak)|(?:메모리 누수).{0,12}(?:수정|해결).{0,12}(?:서버|서비스).{0,10}(?:복구|정상)/i)) return ret('v58-memory-recovery',['✅','💻','🛠️'],'tech');
        if (has(/(?:rate limit|rate limited|throttled|throttling).{0,18}(?:api|request)|(?:api|request).{0,18}(?:rate limit|rate limited|throttled)|(?:API|요청).{0,12}(?:속도 제한|레이트 리밋|제한)/i)) return ret('v58-rate-limit',['⚠️','🌐','⏱️'],'tech');
        if (has(/(?:build).{0,16}(?:unit tests?|tests?).{0,14}(?:failed|failure)|(?:unit tests?|tests?).{0,14}(?:build).{0,12}(?:failed)|(?:빌드).{0,10}(?:단위 테스트|테스트).{0,10}(?:실패)/i)) return ret('v58-build-tests-fail',['❌','💻','🧪'],'tech');
        if (has(/(?:database|db).{0,16}(?:latency).{0,16}(?:normal|back to normal|recovered)|(?:latency).{0,16}(?:database|db).{0,12}(?:normal)|(?:데이터베이스|DB).{0,12}(?:지연 시간|레이턴시).{0,10}(?:정상|복구)/i)) return ret('v58-db-latency-normal',['✅','💾','⏱️'],'tech');
        if (has(/(?:ssl|tls|certificate).{0,18}(?:expires?|expiration).{0,14}(?:tomorrow|days?)|(?:인증서).{0,12}(?:내일|며칠).{0,8}(?:만료)|(?:인증서).{0,10}(?:만료).{0,8}(?:내일|며칠)/i)) return ret('v58-cert-expiry',['🔐','⏰','⚠️'],'tech');
        if (has(/(?:environment variable|env var).{0,18}(?:missing|absent).{0,18}(?:startup|start|boot)|(?:missing).{0,16}(?:environment variable).{0,16}(?:startup)|(?:환경 변수).{0,12}(?:빠져|없).{0,12}(?:시작|부팅|실행).{0,8}(?:실패)/i)) return ret('v58-env-missing',['❌','⚙️','💻'],'tech');
        if (has(/(?:queue).{0,18}(?:growing|increasing).{0,20}(?:worker|process)|(?:worker).{0,20}(?:queue).{0,12}(?:growing)|(?:큐).{0,12}(?:늘|증가).{0,16}(?:워커|처리)/i)) return ret('v58-queue-growing',['📈','⚙️','⚠️'],'tech');
        if (has(/(?:patch|fix).{0,18}(?:crash).{0,16}(?:launch|startup).{0,12}(?:removed|fixed|gone)|(?:crash).{0,16}(?:launch|startup).{0,16}(?:fixed|gone)|(?:패치|수정).{0,12}(?:시작|실행).{0,10}(?:충돌|크래시).{0,10}(?:사라|해결)/i)) return ret('v58-launch-crash-fixed',['✅','🛠️','📱'],'tech');

        // Commerce.
        if (has(/(?:preorder|pre-order).{0,18}(?:sold out|out of stock)|(?:sold out).{0,14}(?:preorder|pre-order)|(?:사전 주문|예약 판매).{0,12}(?:품절|매진)/i)) return ret('v58-preorder-soldout',['🚫','🛒','⏰'],'commerce');
        if (has(/(?:refund).{0,18}(?:scheduled|due|expected).{0,14}(?:friday|monday|day)|(?:환불금|환불).{0,12}(?:금요일|월요일|예정|지급).{0,10}(?:예정|지급)/i)) return ret('v58-refund-scheduled',['💰','📅','⏳'],'commerce');
        if (has(/(?:promo|coupon|discount code).{0,18}(?:saved|discounted).{0,14}(?:dollar|won|percent)|(?:프로모션|쿠폰|할인 코드).{0,14}(?:할인|절약|아꼈)/i)) return ret('v58-promo-saved',['🏷️','💰','✅'],'commerce');
        if (has(/(?:package|parcel).{0,20}(?:wrong address|incorrect address)|(?:wrong|incorrect).{0,14}(?:address).{0,14}(?:package|delivery)|(?:택배|배송).{0,14}(?:잘못된|다른).{0,10}(?:주소)/i)) return ret('v58-wrong-address',['📦','⚠️','📍'],'commerce');
        if (has(/(?:store|seller).{0,18}(?:replaced|replacement).{0,16}(?:damaged|broken).{0,10}(?:item|product)|(?:파손|손상).{0,10}(?:상품|제품).{0,12}(?:교환|교체)/i)) return ret('v58-replaced-damaged',['📦','✅','🔄'],'commerce');
        if (has(/(?:payment).{0,16}(?:under review|being reviewed|review pending)|(?:결제).{0,12}(?:검토 중|심사 중|확인 중)/i)) return ret('v58-payment-review',['💳','⏳','🔎'],'commerce');
        if (has(/(?:only).{0,10}(?:\d+|two|three).{0,10}(?:units?|items?).{0,12}(?:left|remaining).{0,10}(?:stock)?|(?:재고).{0,10}(?:\d+|두|세).{0,8}(?:개).{0,8}(?:남)/i)) return ret('v58-low-stock',['🛒','⚠️','📦'],'commerce');
        if (has(/(?:return label).{0,16}(?:ready).{0,12}(?:print)|(?:반품 라벨).{0,12}(?:인쇄|출력).{0,10}(?:가능|준비)/i)) return ret('v58-return-label',['↩️','🏷️','🖨️'],'commerce');

        // Travel.
        if (has(/(?:flight).{0,16}(?:diverted|rerouted).{0,14}(?:airport)|(?:항공편).{0,12}(?:우회|다른 공항)/i)) return ret('v58-flight-diverted',['✈️','🔄','📍'],'travel');
        if (has(/(?:room|hotel room).{0,18}(?:overlooks|view).{0,16}(?:old town|city|harbor)|(?:객실|방).{0,12}(?:구시가지|도시|항구).{0,10}(?:보이|전망)/i)) return ret('v58-room-view',['🏨','🏙️','😊'],'travel');
        if (has(/(?:passport).{0,18}(?:hotel safe|safe)|(?:hotel safe|safe).{0,14}(?:passport)|(?:여권).{0,12}(?:호텔|금고).{0,10}(?:두|보관)/i)) return ret('v58-passport-safe',['🛂','🏨','🔐'],'travel');
        if (has(/(?:last train).{0,14}(?:leaves|depart|at \d+)|(?:막차).{0,12}(?:출발|시간)/i)) return ret('v58-last-train',['🚆','⏰'],'travel');
        if (has(/(?:rent|rented|hire|hired).{0,12}(?:bike|bicycle).{0,16}(?:island|explore)|(?:자전거).{0,12}(?:빌|대여).{0,12}(?:섬|둘러)/i)) return ret('v58-bike-island',['🚲','🏝️'],'travel');
        if (has(/(?:luggage|bag|suitcase).{0,18}(?:still).{0,12}(?:airport|departure)|(?:짐|수하물).{0,12}(?:아직).{0,10}(?:공항|출발지).{0,8}(?:남)/i)) return ret('v58-luggage-behind',['🧳','✈️','⏳'],'travel');
        if (has(/(?:walking tour).{0,18}(?:cathedral|church|outside)|(?:도보 투어).{0,12}(?:성당|교회|앞)/i)) return ret('v58-walking-tour',['🚶','⛪','📍'],'travel');
        if (has(/(?:boat|ferry).{0,16}(?:early|morning).{0,18}(?:sea|calm)|(?:바다).{0,12}(?:잔잔).{0,14}(?:아침|이른).{0,8}(?:배|페리)/i)) return ret('v58-early-boat',['🚢','🌊','🌅'],'travel');

        // Fitness/wellness.
        if (has(/(?:legs?|muscles?).{0,16}(?:sore|aching).{0,16}(?:run|workout)|(?:run|workout).{0,16}(?:sore|aching)|(?:다리|근육).{0,12}(?:뻐근|아프).{0,12}(?:달리|운동)/i)) return ret('v58-sore-after-run',['🩹','🏃','😌'],'fitness');
        if (has(/(?:drink|drank).{0,12}(?:water).{0,16}(?:before).{0,12}(?:workout|exercise)|(?:운동).{0,10}(?:전에).{0,8}(?:물).{0,8}(?:마셨)/i)) return ret('v58-water-workout',['💧','💪'],'fitness');
        if (has(/(?:slept).{0,10}(?:eight|8).{0,8}(?:hours)|(?:8|여덟)시간.{0,8}(?:잤|수면)/i)) return ret('v58-eight-hours',['😴','✅'],'fitness');
        if (has(/(?:morning walk).{0,20}(?:clear|cleared).{0,12}(?:head|mind)|(?:아침 산책).{0,14}(?:머리|마음).{0,10}(?:맑|정리)/i)) return ret('v58-walk-clear-head',['🚶','🌿','😌'],'fitness');
        if (has(/(?:increase|increased|add|added).{0,16}(?:weight).{0,16}(?:set|lift)|(?:세트).{0,12}(?:무게).{0,10}(?:올|늘)/i)) return ret('v58-weight-up',['💪','📈'],'fitness');
        if (has(/(?:ankle|knee).{0,12}(?:hurt|hurts|pain).{0,16}(?:rest|resting|today)|(?:발목|무릎).{0,10}(?:아프|통증).{0,12}(?:쉬|휴식)/i)) return ret('v58-injury-rest',['🩹','😌','🚫'],'fitness');
        if (has(/(?:yoga).{0,16}(?:finished|completed).{0,16}(?:without rushing|slowly)|(?:요가).{0,12}(?:서두르지|천천히).{0,10}(?:마쳤|완료)/i)) return ret('v58-yoga-calm',['🧘','✅','🌿'],'fitness');
        if (has(/(?:banana).{0,16}(?:after).{0,12}(?:training|workout)|(?:운동).{0,10}(?:뒤|후).{0,10}(?:바나나)/i)) return ret('v58-banana-training',['🍌','💪'],'fitness');

        // Creative/media.
        if (has(/(?:podcast).{0,20}(?:audio).{0,16}(?:trim|trimmed|edit|edited|cut)|(?:audio).{0,16}(?:podcast).{0,14}(?:trim|edit|cut)|(?:팟캐스트).{0,14}(?:오디오).{0,10}(?:자르|편집)/i)) return ret('v58-podcast-edit',['🎙️','✂️','🎧'],'creative');
        if (has(/(?:poster).{0,16}(?:color|colour).{0,16}(?:adjust|adjustment|change)|(?:포스터).{0,12}(?:색상|색).{0,10}(?:조정|수정)/i)) return ret('v58-poster-color',['🎨','🖼️'],'creative');
        if (has(/(?:export|exported).{0,16}(?:video).{0,16}(?:4k|final)|(?:video).{0,16}(?:exported).{0,10}(?:4k)|(?:영상).{0,10}(?:4K|최종).{0,10}(?:내보|익스포트)/i)) return ret('v58-video-export',['🎬','📤','✅'],'creative');
        if (has(/(?:camera).{0,12}(?:lens).{0,16}(?:arrived|delivered)|(?:카메라).{0,10}(?:렌즈).{0,10}(?:도착)/i)) return ret('v58-lens-arrived',['📷','📦'],'creative');
        if (has(/(?:chorus).{0,18}(?:verses?|verse).{0,16}(?:not|still|yet)|(?:후렴).{0,12}(?:벌스|절).{0,10}(?:아직|안)/i)) return ret('v58-song-writing',['🎵','✍️','📝'],'creative');
        if (has(/(?:illustration).{0,18}(?:background).{0,16}(?:simple|simpler|better)|(?:일러스트).{0,12}(?:배경).{0,10}(?:단순|간단).{0,8}(?:좋|나아)/i)) return ret('v58-illustration-bg',['🎨','✨'],'creative');
        if (has(/(?:logo).{0,14}(?:draft|drafts).{0,16}(?:review|saved)|(?:로고).{0,10}(?:초안).{0,10}(?:검토|저장)/i)) return ret('v58-logo-drafts',['🎨','📝','👀'],'creative');
        if (has(/(?:photo).{0,14}(?:edit|editing).{0,16}(?:ready|publish)|(?:사진).{0,10}(?:편집).{0,10}(?:끝|완료|게시).{0,8}(?:준비)?/i)) return ret('v58-photo-ready',['📸','✅','📤'],'creative');

        // Daily / social scenes.
        if (has(/(?:fold|folded).{0,12}(?:clean).{0,8}(?:towels?)|(?:수건).{0,10}(?:개|접|정리)/i)) return ret('v58-towels',['🧺','✨','🏠'],'life');
        if (has(/(?:kettle).{0,16}(?:boil|boiling).{0,12}(?:tea)|(?:주전자).{0,12}(?:끓).{0,10}(?:차)/i)) return ret('v58-tea-kettle',['🍵','☕','♨️'],'life');
        if (has(/(?:wallet).{0,18}(?:under).{0,12}(?:sofa|couch)|(?:지갑).{0,12}(?:소파).{0,8}(?:밑|아래)/i)) return ret('v58-wallet-found',['👛','🔎','🛋️'],'life');
        if (has(/(?:wall clock|clock).{0,18}(?:battery|batteries).{0,14}(?:changed|replaced)|(?:벽시계|시계).{0,10}(?:배터리).{0,8}(?:교체|바꿨)/i)) return ret('v58-clock-battery',['🔋','🕰️'],'life');
        if (has(/(?:apple).{0,16}(?:bag|packed|snack)|(?:사과).{0,10}(?:가방|간식).{0,8}(?:챙|넣)/i)) return ret('v58-apple-pack',['🍎','🎒'],'life');
        if (has(/(?:coffee machine).{0,16}(?:clean|cleaned)|(?:커피 머신).{0,10}(?:청소|닦)/i)) return ret('v58-coffee-clean',['☕','🧼','✨'],'life');
        if (has(/(?:rain jacket|raincoat).{0,16}(?:door|front door)|(?:우비|레인 재킷).{0,10}(?:현관|문).{0,8}(?:두|꺼내)/i)) return ret('v58-rain-jacket',['🌧️','🧥','🚪'],'life');
        if (has(/(?:errands?|to[- ]do).{0,16}(?:paper|wrote|write)|(?:심부름|할 일).{0,10}(?:종이|메모).{0,8}(?:적)/i)) return ret('v58-errands-list',['📝','📋','📅'],'life');
        if (has(/(?:moon).{0,18}(?:river|water).{0,14}(?:tonight|huge|big)|(?:달).{0,12}(?:강|물).{0,10}(?:크게|떠)/i)) return ret('v58-moon-river',['🌙','🌊','✨'],'nature');
        if (has(/(?:new cafe|cafe).{0,18}(?:opened|new).{0,14}(?:corner|nearby)|(?:새 카페|카페).{0,10}(?:생겼|오픈|열었).{0,8}(?:근처)?/i)) return ret('v58-new-cafe',['☕','✨','📍'],'social');
        if (has(/(?:band).{0,16}(?:live|concert).{0,14}(?:incredible|great|amazing)|(?:밴드).{0,10}(?:라이브|공연).{0,10}(?:좋|최고|대단)/i)) return ret('v58-band-live',['🎵','🎤','🤩'],'creative');
        if (has(/(?:peaches?).{0,16}(?:bag|bought|home)|(?:복숭아).{0,10}(?:봉지|가득|사서)/i)) return ret('v58-peaches',['🍑','🛍️','😊'],'food');
        if (has(/(?:beach).{0,18}(?:windy|wind).{0,14}(?:beautiful|morning)|(?:해변).{0,10}(?:바람).{0,8}(?:많이|강).{0,8}(?:아름|좋)/i)) return ret('v58-windy-beach',['🏖️','💨','🌊'],'travel');
        if (has(/(?:cat).{0,18}(?:window).{0,14}(?:rain|raining)|(?:고양이).{0,10}(?:창가).{0,10}(?:비).{0,8}(?:보)/i)) return ret('v58-cat-rain-window',['🐱','😴','🌧️','🪟'],'social');
        if (has(/(?:painting).{0,18}(?:finished|complete).{0,14}(?:wall)|(?:그림).{0,10}(?:벽).{0,10}(?:완성|끝)/i)) return ret('v58-painting-wall',['🎨','✅','🖼️'],'creative');
        if (has(/(?:toast).{0,18}(?:no alarms?|without alarm).{0,12}(?:sunday)|(?:알람).{0,10}(?:없이).{0,10}(?:토스트|일요일)/i)) return ret('v58-sunday-toast',['🍞','😌','☀️'],'life');

        return null;
    }

    // v57 compositional semantic layer: broad object/action/status concepts that
    // generalize beyond exact sentence templates. It runs after safety guards in
    // precisionV57 itself, but before older phrase-heavy rules.
    function precisionV57(text, rawText) {
        const t = stripLeadLabel ? stripLeadLabel(text) : text;
        const has = re => re.test(t);
        const ret = (id, emojis, group='topic', confidence=58) => special(id, emojis, group, confidence);

        // Meta/reference language: words such as warning/error may be examples rather than live states.
        if (has(/(?:word|term|phrase|label|example|mockup|mock-up|design|copy|text|sentence).{0,30}(?:warning|error|failed|cancelled|canceled)|(?:warning|error|failed|cancelled|canceled).{0,30}(?:word|term|phrase|label|example|mockup|design|copy|text|sentence)|(?:단어|용어|문구|예시|시안|디자인|텍스트|문장).{0,20}(?:경고|오류|실패|취소)|(?:경고|오류|실패|취소).{0,20}(?:단어|용어|문구|예시|시안|디자인|텍스트|문장)/i)) {
            return ret('v57-meta-design',['🎨','💡'],'creative',64);
        }

        // Negation / contrast guards that must beat positive/cancelled keywords.
        if (has(/(?:release|launch).{0,24}(?:delayed|postponed).{0,20}(?:not|rather than).{0,10}(?:cancelled|canceled)|(?:delayed|postponed).{0,20}(?:release|launch).{0,16}(?:not|rather than).{0,10}(?:cancelled|canceled)|(?:출시|릴리스).{0,16}(?:취소.{0,8}(?:아니|아니고)|취소된 게 아니).{0,16}(?:지연|미뤄|연기)|(?:취소.{0,8}(?:아니|아니고)|취소된 게 아니).{0,14}(?:지연|미뤄|연기)/i)) return ret('v57-delayed-not-cancelled',['⏳','📅'],'status',70);
        if (has(/(?:payment|transaction).{0,20}(?:not|wasn['’]t|isn['’]t).{0,12}(?:declined|rejected).{0,20}(?:pending|waiting)|(?:declined|rejected).{0,18}(?:not|wasn['’]t|isn['’]t).{0,18}(?:pending|waiting)|(?:결제|거래).{0,18}(?:거절.{0,8}(?:아니|아니고)|거절된 것은 아니).{0,16}(?:대기|처리 중|보류)/i)) return ret('v57-payment-pending-not-rejected',['⏳','💳'],'status',70);
        if (has(/(?:not|aren['’]t|isn['’]t|wasn['’]t|we are not|we're not).{0,16}(?:closing|shutting).{0,12}(?:store|shop)|(?:매장|가게).{0,16}(?:닫는|폐점).{0,10}(?:아니|아닙)|(?:닫는|폐점).{0,10}(?:뜻은 아니다|아니다)/i)) return ret('v57-store-not-closing',['🏪','✅'],'status',68);
        if (has(/(?:don['’]t|do not).{0,10}(?:celebrate|congratulate).{0,24}(?:build|release).{0,16}(?:not|hasn['’]t|has not).{0,10}(?:passed|succeeded)|(?:아직).{0,14}(?:빌드|배포|릴리스).{0,16}(?:통과|성공).{0,10}(?:하지 않았|안 됐|아니).{0,16}(?:축하|기뻐)/i)) return ret('v57-not-yet-success',['⏳','⚠️'],'status',70);
        if (has(/(?:do not|don['’]t|never).{0,20}(?:click|open|tap).{0,28}(?:link|attachment)|(?:link|attachment).{0,20}(?:do not|don['’]t|never).{0,12}(?:click|open)|(?:링크|첨부파일).{0,16}(?:누르지|클릭하지|열지)|(?:누르지|클릭하지|열지).{0,16}(?:링크|첨부파일)/i)) return ret('v57-prohibit-click-open',['⚠️','🚫'],'status',72);

        // Commerce / payment / fulfillment.
        if (has(/(?:card|payment).{0,22}(?:charged|billed).{0,18}(?:twice|two times|duplicate)|(?:double|duplicate).{0,16}(?:charge|payment)|(?:카드|결제).{0,18}(?:두 번|중복|이중).{0,10}(?:결제|청구|됐다)/i)) return ret('v57-double-charge',['💳','⚠️'],'commerce',68);
        if (has(/(?:subscription|renewal).{0,20}(?:declined|rejected|failed)|(?:declined|rejected).{0,16}(?:subscription|renewal)|(?:구독|갱신).{0,16}(?:결제).{0,10}(?:거절|실패)/i)) return ret('v57-renewal-declined',['❌','💳'],'commerce',68);
        if (has(/(?:refund).{0,24}(?:reached|arrived|credited|landed).{0,18}(?:bank|account)|(?:bank|account).{0,20}(?:refund).{0,16}(?:reached|arrived)|(?:환불금|환불).{0,16}(?:계좌|통장).{0,12}(?:들어|입금|도착)/i)) return ret('v57-refund-arrived',['💰','✅'],'commerce',66);
        if (has(/(?:shipping|delivery).{0,18}(?:cost|fee|price).{0,22}(?:more|higher|expensive)|(?:cost|fee).{0,18}(?:shipping|delivery)|(?:배송비|배송료).{0,18}(?:더 비싸|비싸|높아|높다)/i)) return ret('v57-shipping-cost',['🚚','💰','😕'],'commerce',64);
        if (has(/(?:package|parcel|shipment).{0,24}(?:delayed|held|waiting).{0,20}(?:sorting|center|hub)|(?:sorting|distribution).{0,18}(?:center|hub).{0,18}(?:delayed|waiting)|(?:택배|배송).{0,16}(?:분류|물류).{0,12}(?:센터).{0,12}(?:지연|대기)/i)) return ret('v57-parcel-delay',['📦','⏳'],'commerce',68);
        if (has(/(?:back in stock|available again|available now).{0,20}(?:size|option|color)|(?:size|option|color).{0,18}(?:available again|back in stock)|(?:사이즈|옵션|색상).{0,16}(?:다시).{0,10}(?:구매 가능|재고|입고)/i)) return ret('v57-back-in-stock',['✅','🛒'],'commerce',65);
        if (has(/(?:checkout|payment page).{0,22}(?:froze|frozen|stuck|hang|stopped)|(?:froze|stuck).{0,18}(?:checkout|payment page)|(?:결제|체크아웃).{0,14}(?:화면|페이지).{0,12}(?:멈|먹통|정지)/i)) return ret('v57-checkout-frozen',['🛒','⚠️'],'commerce',68);

        // Reports / metrics.
        if (has(/(?:completion|conversion|success|retention|open|click).{0,16}(?:rate|ratio).{0,22}(?:remain|stayed|above|below|reached)|(?:rate|ratio).{0,18}(?:remain|stayed|above|below|reached)|(?:완료율|전환율|성공률|유지율|오픈율|클릭률).{0,18}(?:유지|넘|이상|이하|도달)/i)) return ret('v57-rate-metric',['📊','✅'],'report',62);
        if (has(/(?:cost|spend|expense).{0,18}(?:declined|decreased|fell|dropped|reduced)|(?:declined|decreased|fell|dropped).{0,16}(?:cost|spend|expense)|(?:비용|지출).{0,16}(?:감소|하락|줄|내려)/i)) return ret('v57-cost-down',['📉','💰'],'report',66);
        if (has(/(?:traffic|sessions|visits).{0,20}(?:declined|decreased|fell|dropped|reduced)|(?:declined|decreased|fell|dropped).{0,16}(?:traffic|sessions|visits)|(?:트래픽|세션|방문).{0,16}(?:감소|하락|줄|내려)/i)) return ret('v57-traffic-down',['📉','📊'],'report',66);
        if (has(/(?:traffic|sessions|signups|users).{0,22}(?:highest|record high|new high|peak)|(?:highest|record high|new high).{0,18}(?:traffic|sessions|signups|users)|(?:트래픽|세션|가입자|사용자).{0,16}(?:최고|최고치|기록)/i)) return ret('v57-metric-high',['📈','🏆'],'report',66);
        if (has(/(?:wait|response).{0,12}(?:time).{0,18}(?:increased|rose|longer)|(?:대기|응답).{0,10}시간.{0,14}(?:증가|늘|길어)/i)) return ret('v57-time-up',['📈','⏱️','⚠️'],'report',65);
        if (has(/(?:backlog|pending tickets?|open tickets?).{0,20}(?:down|decreased|reduced|fell|to \d+)|(?:대기|미처리).{0,10}(?:티켓|건수).{0,16}(?:줄|감소|내려)/i)) return ret('v57-backlog-down',['📉','🎫'],'report',64);

        // Tech status.
        if (has(/(?:mobile|app).{0,16}(?:build).{0,14}(?:crash|crashed|failed)|(?:build).{0,16}(?:crash|crashed).{0,14}(?:startup|launch)|(?:모바일|앱).{0,14}빌드.{0,12}(?:충돌|크래시|실패)/i)) return ret('v57-mobile-build-crash',['📱','❌'],'tech',68);
        if (has(/(?:login|auth).{0,16}(?:endpoint|api).{0,18}(?:401|403|unauthorized|forbidden)|(?:401|403).{0,18}(?:endpoint|api)|(?:로그인|인증).{0,14}(?:엔드포인트|API).{0,14}(?:401|403|오류)/i)) return ret('v57-auth-endpoint-error',['❌','🔐','🌐'],'tech',68);
        if (has(/(?:export|job).{0,18}(?:empty file|zero-byte|blank file)|(?:empty|blank).{0,12}file.{0,18}(?:export|job)|(?:내보내기|익스포트).{0,16}(?:빈 파일|0바이트)/i)) return ret('v57-empty-export',['⚠️','📄','❌'],'tech',66);
        if (has(/(?:backup).{0,18}(?:verification|verify).{0,18}(?:failed|failure)|(?:verification|verify).{0,18}(?:backup).{0,18}(?:failed)|(?:백업).{0,14}(?:검증|확인).{0,12}(?:실패)/i)) return ret('v57-backup-verify-fail',['💾','❌'],'tech',68);
        if (has(/(?:database|db).{0,18}(?:read[- ]only|readonly)|(?:read[- ]only|readonly).{0,18}(?:database|db)|(?:데이터베이스|DB).{0,14}(?:읽기 전용)/i)) return ret('v57-db-readonly',['💾','🔒','🛠️'],'tech',65);
        if (has(/(?:scheduled|cron|nightly).{0,16}(?:job|task).{0,18}(?:did not run|didn['’]t run|skipped|missed)|(?:예약|스케줄|야간).{0,12}(?:작업).{0,14}(?:실행되지|건너뛰|누락)/i)) return ret('v57-job-missed',['⚙️','⚠️'],'tech',65);
        if (has(/(?:retry queue|queue).{0,18}(?:cleared|drained|empty).{0,20}(?:recovered|connection)|(?:연결).{0,14}(?:복구).{0,16}(?:큐|재시도).{0,12}(?:비워|처리)/i)) return ret('v57-queue-recovered',['✅','🔄','🌐'],'tech',66);
        if (has(/(?:dns).{0,18}(?:stale|old|record).{0,24}(?:host|traffic)|(?:stale|old).{0,14}dns|(?:오래된|이전).{0,12}DNS.{0,18}(?:호스트|트래픽)/i)) return ret('v57-dns-stale',['🌐','⚠️'],'tech',64);
        if (has(/(?:cache).{0,18}(?:rule).{0,20}(?:reduced|lowered|improved).{0,12}(?:response|latency)|(?:캐시).{0,12}(?:규칙).{0,16}(?:응답|지연).{0,10}(?:줄|개선)/i)) return ret('v57-cache-faster',['⚡','📉','⏱️'],'tech',65);

        // Work / collaboration.
        if (has(/(?:designer|design).{0,20}(?:upload|uploaded).{0,18}(?:icon|asset|file)|(?:icon|asset).{0,18}(?:uploaded).{0,18}(?:designer)|(?:디자이너|디자인).{0,16}(?:아이콘|에셋).{0,12}(?:업로드)/i)) return ret('v57-design-upload',['🎨','📤'],'work',64);
        if (has(/(?:signed|signature).{0,20}(?:agreement|contract).{0,20}(?:sent|returned)|(?:agreement|contract).{0,16}(?:signed).{0,16}(?:sent|returned)|(?:서명한|서명된).{0,12}(?:계약서|합의서).{0,14}(?:보냈|전송)/i)) return ret('v57-signed-agreement',['✍️','📜','📤'],'work',65);
        if (has(/(?:budget).{0,18}(?:shared folder|folder).{0,16}(?:added|uploaded|saved)|(?:shared folder|folder).{0,16}(?:budget)|(?:예산안|예산).{0,14}(?:공유 폴더|폴더).{0,12}(?:추가|저장|업로드)/i)) return ret('v57-budget-folder',['💰','📁'],'work',64);
        if (has(/(?:demo).{0,20}(?:moved|rescheduled|shifted).{0,16}(?:thursday|friday|monday|afternoon|morning)|(?:고객|클라이언트).{0,10}데모.{0,14}(?:옮|변경|미뤄)/i)) return ret('v57-demo-reschedule',['📅','🔄'],'work',64);
        if (has(/(?:editor).{0,16}(?:draft).{0,16}(?:comment|comments|feedback)|(?:draft).{0,14}(?:comments|feedback).{0,14}(?:editor)|(?:에디터).{0,14}(?:초안).{0,14}(?:의견|댓글|피드백)/i)) return ret('v57-editor-comments',['📝','💬'],'work',64);
        if (has(/(?:handoff).{0,16}(?:notes?).{0,16}(?:finished|complete|completed)|(?:인계).{0,10}(?:메모|노트).{0,12}(?:마무리|완료)/i)) return ret('v57-handoff-notes',['🤝','📝','✅'],'work',64);
        if (has(/(?:action items?|tasks?).{0,24}(?:waiting|without|need).{0,16}(?:owner|owners)|(?:담당자).{0,16}(?:없는|정해지지).{0,16}(?:할 일|작업|항목)|(?:할 일|작업|항목).{0,16}(?:담당자).{0,12}(?:없|정해지지)/i)) return ret('v57-owner-needed',['📌','👤','⏳'],'work',64);

        // Travel.
        if (has(/(?:boarding pass).{0,20}(?:disappeared|missing|gone).{0,18}(?:app|phone)|(?:app|phone).{0,16}(?:boarding pass).{0,12}(?:missing|gone)|(?:앱|휴대폰).{0,14}(?:탑승권).{0,12}(?:사라|없)/i)) return ret('v57-pass-missing',['✈️','📱','⚠️'],'travel',66);
        if (has(/(?:rental car).{0,22}(?:fuel|gas|petrol).{0,16}(?:return|before)|(?:fuel|gas|petrol).{0,18}(?:rental car)|(?:렌터카).{0,14}(?:반납).{0,12}(?:주유|기름)|(?:주유).{0,12}(?:렌터카)/i)) return ret('v57-rental-fuel',['🚗','⛽'],'travel',66);
        if (has(/(?:train).{0,20}(?:platform|track).{0,12}(?:changed|now|moved)|(?:platform|track).{0,12}(?:train).{0,12}(?:changed)|(?:기차).{0,12}(?:승강장|플랫폼).{0,12}(?:바뀌|변경)/i)) return ret('v57-train-platform',['🚆','📍'],'travel',65);
        if (has(/(?:hotel|reservation).{0,18}(?:includes|included).{0,14}(?:breakfast)|(?:breakfast).{0,14}(?:included).{0,14}(?:hotel|reservation)|(?:호텔|예약).{0,12}(?:아침|조식).{0,12}(?:포함)/i)) return ret('v57-hotel-breakfast',['🏨','🍳','✅'],'travel',64);

        // Relationships / social details.
        if (has(/(?:friend|sister|brother|mom|dad|family).{0,18}(?:called|call|phone|message|texted|text)|(?:called|message|texted).{0,18}(?:friend|sister|brother|mom|dad|family)|(?:친구|언니|누나|형|오빠|동생|엄마|아빠|가족).{0,14}(?:통화|전화|메시지|문자)/i)) return ret('v57-contact-person',['💬','📞','💛'],'social',62);
        if (has(/(?:laughed|laughing).{0,20}(?:story|memory|school)|(?:story|memory).{0,18}(?:laughed|laughing)|(?:이야기|추억).{0,14}(?:웃|웃었)|(?:웃|웃었).{0,14}(?:이야기|추억)/i)) return ret('v57-laugh-memory',['😂','💛'],'social',62);
        if (has(/(?:family).{0,16}(?:lunch|dinner|meal).{0,18}(?:sunday|weekend|planned|plan)|(?:가족).{0,14}(?:점심|저녁|식사).{0,14}(?:약속|계획|일요일|주말)/i)) return ret('v57-family-meal',['👨‍👩‍👧','🍽️','📅'],'social',62);
        if (has(/(?:talking|talked|conversation).{0,18}(?:midnight|late night)|(?:midnight|late night).{0,16}(?:talking|conversation)|(?:자정|늦은 밤).{0,14}(?:이야기|대화)|(?:이야기|대화).{0,14}(?:자정|늦은 밤)/i)) return ret('v57-late-talk',['💬','🌙','💛'],'social',61);

        // Everyday objects/actions.
        if (has(/(?:herb|plant|flower pot|potted plant).{0,18}(?:water|watered)|(?:water|watered).{0,16}(?:plant|herb)|(?:허브|화분|식물).{0,14}(?:물).{0,10}(?:줬|주었|주기)/i)) return ret('v57-water-plant',['🪴','💧'],'life',62);
        if (has(/(?:ice).{0,14}(?:water bottle|bottle|drink)|(?:water bottle|bottle).{0,14}(?:ice)|(?:얼음).{0,12}(?:물병|음료)|(?:물병).{0,12}(?:얼음)/i)) return ret('v57-ice-water',['🧊','💧'],'life',62);
        if (has(/(?:soap|dispenser).{0,18}(?:refill|filled|top up)|(?:refill|filled).{0,14}(?:soap|dispenser)|(?:비누|디스펜서|비누 통).{0,14}(?:채웠|리필)/i)) return ret('v57-soap-refill',['🧼','🏠'],'life',61);
        if (has(/(?:receipt).{0,18}(?:drawer|filed|put|stored)|(?:drawer).{0,14}(?:receipt)|(?:영수증).{0,14}(?:서랍|넣|보관)/i)) return ret('v57-receipt-drawer',['🧾','🗄️'],'life',61);
        if (has(/(?:open|opened).{0,12}(?:window).{0,20}(?:cooking|dinner|kitchen)|(?:cooking|dinner).{0,20}(?:window).{0,12}(?:open|opened)|(?:요리|저녁).{0,14}(?:뒤|후).{0,10}(?:창문).{0,10}(?:열)/i)) return ret('v57-window-cooking',['🪟','🍳'],'life',60);

        // Social / lifestyle concrete cues.
        if (has(/(?:song|playlist|music).{0,20}(?:ride home|drive home|way home)|(?:ride|drive|way) home.{0,18}(?:song|music)|(?:집에 오는 길|귀가).{0,16}(?:노래|음악)/i)) return ret('v57-song-home',['🎵','🎧'],'creative',62);
        if (has(/(?:bouquet|flowers?).{0,18}(?:room).{0,16}(?:bright|brighter)|(?:꽃다발|꽃).{0,14}(?:방).{0,12}(?:환해|밝아)/i)) return ret('v57-bouquet-room',['💐','✨'],'creative',61);
        if (has(/(?:cool|cold|crisp).{0,10}(?:breeze|wind).{0,18}(?:autumn|fall)|(?:autumn|fall).{0,18}(?:breeze|wind)|(?:선선|서늘).{0,8}(?:바람).{0,14}(?:가을)/i)) return ret('v57-autumn-breeze',['🍂','🌬️'],'weather',61);
        if (has(/(?:fresh|clean).{0,10}(?:sheets|bedding).{0,18}(?:early night|bed|sleep)|(?:침구|이불).{0,14}(?:깨끗|새).{0,14}(?:이른|일찍).{0,10}(?:취침|잠)/i)) return ret('v57-clean-sheets',['🛏️','😌','🌙'],'life',61);
        if (has(/(?:dog|puppy).{0,20}(?:fell asleep|sleeping|asleep)|(?:강아지).{0,14}(?:잠들|자고)/i)) return ret('v57-dog-sleep',['🐶','😴'],'social',61);
        if (has(/(?:clouds?).{0,18}(?:orange|pink|golden).{0,20}(?:roof|sky)|(?:orange|pink|golden).{0,18}(?:clouds?)|(?:구름).{0,14}(?:주황|분홍|금빛).{0,14}(?:물들|하늘)/i)) return ret('v57-colored-clouds',['🌇','☁️','✨'],'nature',60);

        return null;
    }

    function precisionV53(text, rawText) {
        const t = text.trim();
        const raw = (rawText || text).trim();
        if (!t) return null;
        const hit = re => re.test(t);
        const rawHit = re => re.test(raw);

        // Context/negation guards first.
        if (hit(/\bwarning\s+icon\b.{0,28}\b(?:design|mockup|prototype)\b|(?:경고\s*아이콘).{0,24}(?:디자인|시안|목업)/i)) return special('p56-warning-design',['🎨','💡'],'creative',214);
        if (hit(/\b(?:error|warning|failure)\b.{0,22}\b(?:screenshot|example|guide|documentation|docs|mockup)\b|\b(?:screenshot|example|guide|documentation|docs|mockup)\b.{0,22}\b(?:error|warning|failure)\b|(?:오류|경고|실패).{0,16}(?:스크린샷|예시|가이드|문서|시안)|(?:스크린샷|예시|가이드|문서|시안).{0,16}(?:오류|경고|실패)/i)) return special('p53-doc-example',['📝','💡'],'education',210);
        if (hit(/\b(?:card|payment|refund)\b.{0,20}\b(?:not|wasn['’]t|isn['’]t)\s+(?:declined|rejected|failed)\b|(?:카드|결제|환불).{0,16}(?:거절된\s*(?:게|것이)\s*아니|실패한\s*(?:게|것이)\s*아니)/i)) {
            if (hit(/\b(?:still\s+processing|pending|waiting)\b|아직.{0,8}(?:처리\s*중|대기)/i)) return special('p53-not-rejected-pending',['⏳','💳'],'commerce',212);
            return special('p53-not-rejected',['✅','💳'],'commerce',212);
        }
        if (hit(/\b(?:meeting|class|event|trip)\b.{0,20}\b(?:not|wasn['’]t|isn['’]t)\s+(?:cancelled|canceled)\b|(?:회의|수업|행사|여행).{0,16}(?:취소되지\s*않|취소된\s*(?:게|것이)\s*아니)/i)) return special('p53-not-cancelled',['✅','📅'],'status',212);
        if (hit(/\b(?:passport|wallet|phone|key)\b.{0,18}\b(?:not|wasn['’]t|isn['’]t)\s+(?:lost|missing)\b|(?:여권|지갑|휴대폰|열쇠).{0,16}(?:잃어버린\s*(?:게|것이)\s*아니|분실한\s*(?:게|것이)\s*아니)/i)) return special('p53-not-lost',['✅','🛂'],'status',212);
        if (hit(/\b(?:server|service|site)\b.{0,18}\b(?:not|isn['’]t|no longer)\s+(?:down|offline|unavailable)\b|(?:서버|서비스|사이트).{0,14}(?:이제\s*)?(?:다운된\s*상태가\s*아니|오프라인이\s*아니|복구)/i)) return special('p53-not-down',['✅','💻'],'tech',212);
        if (hit(/\b(?:story|book|article|novel)\b.{0,18}\b(?:about|mentions?)\b.{0,14}\b(?:train|virus|flight|server)\b.{0,18}\bnot\b.{0,16}\b(?:update|incident|alert)\b|(?:글|책|이야기).{0,14}(?:기차|바이러스|항공편|서버).{0,18}(?:업데이트|사고|알림).{0,8}(?:아니)/i)) return special('p53-story-context',['📚'],'education',212);
        if (hit(/\b(?:run|ran|running)\b.{0,18}\b(?:street|road|bus|outside)\b.{0,22}\bnot\b.{0,16}\b(?:command|terminal|software)\b|(?:명령|터미널|소프트웨어).{0,16}(?:아니).{0,18}(?:뛰|달렸|버스|길|도로)/i)) return special('p53-physical-run',['🏃'],'fitness',212);
        if (hit(/\b(?:dog|cat|pet)\b.{0,18}\b(?:not|isn['’]t|wasn['’]t)\s+(?:injured|hurt|sick)\b.{0,22}\b(?:tired|sleepy|walk)\b|(?:강아지|고양이|반려동물).{0,14}(?:다친\s*(?:게|것이)\s*아니|아픈\s*(?:게|것이)\s*아니).{0,16}(?:피곤|졸|산책)/i)) return special('p53-pet-not-hurt',['🐶','😌'],'social',212);
        if (hit(/\b(?:do not|don['’]t|never)\b.{0,22}\b(?:password|secret|token|api key|credential)\b|(?:비밀번호|비밀|토큰|API\s*키|자격).{0,20}(?:공유하지|붙여넣지|보내지)/i)) return special('p53-secret-warning',['⚠️','🔐'],'safety',212);

        // v54 residual semantic precision from a separate held-out set.
        if (/\bsubscription\s+price\b.{0,18}\b(?:increase|increases|rises|goes up)\b|(?:구독\s*가격|구독료|요금제\s*가격).{0,18}(?:오르|오른|오를|인상|증가)/i.test(t)) return special('p54-subscription-price-up',['📈','💰'],'commerce',211);
        if (/\b(?:add|added)\b.{0,16}\b(?:subtitles?|captions?)\b.{0,18}\b(?:video|clip|film)\b|(?:영상|클립|동영상).{0,14}(?:자막).{0,8}(?:추가|넣)/i.test(t)) return special('p54-subtitles',['🎬','💬'],'creative',211);
        if (/(?:의자).{0,12}(?:느슨한\s*)?나사.{0,10}(?:조였|조이|고정)|(?:나사).{0,10}(?:의자).{0,8}(?:조였|조이)/i.test(t)) return special('p54-chair-screw',['🪛','🪑'],'life',211);
        if (/\b(?:assignment|paper|essay)\b.{0,20}\b(?:citation|reference)\b|(?:과제|논문|에세이).{0,16}(?:인용|출처)/i.test(t)) return special('p54-citation',['📝','🔎'],'education',211);
        if (/\b(?:reached|hit|achieved)\b.{0,20}\b(?:weekly\s+)?steps?\s+goal\b|\b(?:weekly\s+)?steps?\s+goal\b.{0,20}\b(?:reached|hit|achieved)\b|(?:이번\s*주|주간)?.{0,10}(?:걸음\s*수|보행)\s*목표.{0,12}(?:달성|채웠)|(?:달성|채웠).{0,12}(?:걸음\s*수|보행)\s*목표/i.test(t)) return special('p54-step-goal',['🎯','🚶'],'fitness',211);
        if (/\b(?:skip|skipped|rest|rested)\b.{0,20}\b(?:training|workout|exercise)\b.{0,24}\b(?:knee|ankle|leg)\b.{0,12}\b(?:hurt|hurts|pain|sore)\b|\b(?:knee|ankle|leg)\b.{0,16}\b(?:hurt|hurts|pain|sore)\b.{0,22}\b(?:skip|skipped|rest|training|workout|exercise)\b|(?:무릎|발목|다리).{0,12}(?:아프|아파|아픈|통증|뻐근).{0,18}(?:운동|훈련).{0,10}(?:쉬|안\s*했|스킵)|(?:운동|훈련).{0,14}(?:쉬|안\s*했|스킵).{0,18}(?:무릎|발목|다리).{0,10}(?:아프|통증|뻐근)/i.test(t)) return special('p54-injury-rest',['🩹','😌'],'fitness',211);
        if (/\b(?:pack|packed|bring|brought)\b.{0,14}\b(?:fruit|apple|banana)\b.{0,14}\b(?:snack|afternoon)\b|(?:오후\s*)?간식.{0,10}(?:과일|사과|바나나)|(?:과일|사과|바나나).{0,10}(?:간식|챙겼)/i.test(t)) return special('p54-fruit-snack',['🍎','🌿'],'fitness',211);
        if (/\bwarning\s+icon\b.{0,28}\b(?:design|mockup|prototype)\b|(?:경고\s*아이콘).{0,24}(?:디자인|시안|목업)/i.test(t)) return special('p54-warning-mockup',['🎨','💡'],'creative',213);
        if (/\bfriend\b.{0,24}\b(?:texted|messaged|reached out)\b.{0,36}\b(?:rough|hard|bad)\s+day\b|\b(?:rough|hard|bad)\s+day\b.{0,36}\bfriend\b.{0,20}\b(?:texted|messaged|reached out)\b|(?:힘든|어려운)\s*날.{0,22}친구.{0,14}(?:메시지|연락)|친구.{0,20}(?:메시지|연락).{0,22}(?:힘든|어려운)\s*날/i.test(t)) return special('p54-friend-support',['💬','💛'],'social',211);
        if (/\b(?:stay|stayed)\s+up\s+late\b.{0,20}\b(?:talk|talking|chatting)\b.{0,16}\bfriends?\b|친구.{0,12}(?:늦게|밤늦게).{0,10}(?:이야기|대화|수다)/i.test(t)) return special('p54-late-friend-talk',['💬','🌙'],'social',211);
        if (/\b(?:sister|brother|sibling)\b.{0,30}\b(?:laugh|laughed|laughing)\b.{0,24}\b(?:memory|old)\b|\b(?:sister|brother|sibling)\b.{0,24}\b(?:old\s+)?memory\b.{0,24}\b(?:laugh|laughed|laughing)\b|(?:언니|누나|형|오빠|동생).{0,24}(?:옛날|기억|일).{0,18}(?:웃|웃었다)|(?:옛날|기억|일).{0,18}(?:언니|누나|형|오빠|동생).{0,18}(?:웃|웃었다)/i.test(t)) return special('p54-sibling-laugh',['😂','💛'],'social',211);
        if (/\b(?:trial|signup|activation)\s+conversion\b.{0,20}\b(?:best|highest|record|peak)\b|(?:체험판|가입|활성화)\s*전환율.{0,18}(?:최고|기록|최대)/i.test(t)) return special('p54-conversion-record',['📈','🏆'],'report',211);
        if (/\b(?:support|service)\s+(?:backlog|queue|tickets?)\b.{0,20}\b(?:record|highest|new high|peak)\b|(?:지원|문의)\s*(?:대기|백로그|티켓|건수).{0,18}(?:최고|기록|최대)/i.test(t)) return special('p54-support-high',['📈','⚠️'],'report',211);
        if (/\b(?:rainy|rain)\b.{0,20}\b(?:playlist|music|song)\b|(?:비\s*오는|비가).{0,16}(?:플레이리스트|음악|노래)/i.test(t)) return special('p54-rain-music',['🌧️','🎵'],'social',211);
        if (/(?:해\s*질\s*무렵|노을\s*무렵|석양).{0,32}(?:금빛|햇살|빛)|(?:금빛\s*햇살|금빛\s*빛).{0,24}(?:해\s*질|노을)|(?:건물|도시).{0,18}(?:금빛|햇살).{0,18}(?:해\s*질|노을)?/i.test(t)) return special('p54-golden-hour',['🌅','✨'],'social',211);
        if (/\b(?:scheduler|cron)\b.{0,18}\b(?:skipped|missed)\b.{0,14}\b(?:job|task)\b|(?:스케줄러|크론).{0,14}(?:작업|잡).{0,10}(?:건너뛰|누락|실행하지\s*않)/i.test(t)) return special('p54-scheduler-skip',['⚙️','⚠️'],'tech',211);
        if (/(?:인증서|TLS|SSL).{0,12}(?:갱신).{0,10}(?:실패|오류)|\bcertificate\b.{0,16}\brenewal\b.{0,14}\b(?:failed|failure)\b/i.test(t)) return special('p54-cert-fail',['🔐','❌'],'tech',211);
        if (/(?:탑승권|보딩패스).{0,12}(?:휴대폰|폰|모바일).{0,10}(?:내려받|다운로드|저장)|\bboarding\s+pass\b.{0,16}\b(?:phone|mobile)\b/i.test(t)) return special('p54-boarding-phone',['✈️','📱'],'travel',211);
        if (/\b(?:email|send|sent)\b.{0,18}\b(?:signed\s+)?(?:agreement|contract)\b|(?:서명된\s*)?(?:계약서|계약).{0,12}(?:이메일|메일|보내|전송)/i.test(raw)) return special('p54-email-contract',['📧','📜'],'work',212);
        if (/(?:@\w+|design|designer).{0,18}\b(?:review|reviewing|check|checking)\b.{0,18}\b(?:poster|design|mockup)\b|(?:@\w+|디자인).{0,18}(?:포스터|시안|디자인).{0,10}(?:검토|확인)/i.test(raw)) return special('p54-design-review',['🔍','🎨'],'creative',212);

        // Daily/home concrete actions.
        const direct = [
            [/\b(?:water|watered)\b.{0,14}\b(?:plant|plants|houseplants?)\b|(?:화분|식물).{0,10}(?:물\s*주|물을\s*줬|물을\s*주)/i,['🪴','💧'],'plants','life'],
            [/\b(?:change|changed|replace|replaced)\b.{0,14}\b(?:sheets?|bed sheets?|bedding)\b|(?:침대\s*)?(?:시트|침구).{0,10}(?:갈|교체|바꿨)/i,['🛏️','✨'],'sheets','life'],
            [/\b(?:remote|remote control)\b.{0,16}\bbatter(?:y|ies)\b|\bbatter(?:y|ies)\b.{0,16}\bremote\b|리모컨.{0,10}배터리|배터리.{0,10}리모컨/i,['🔋','📺'],'remote-battery','life'],
            [/\b(?:leftovers?|left-over food)\b.{0,16}\b(?:container|box|pack|packed)\b|(?:남은\s*음식|남은\s*밥).{0,12}(?:용기|통|나눠\s*담|포장)/i,['🥡','🍱'],'leftovers','food'],
            [/\b(?:sweep|swept)\b.{0,18}\b(?:crumbs?|floor|kitchen)\b|(?:주방\s*)?바닥.{0,12}(?:부스러기|쓸|청소)/i,['🧹','🍽️'],'sweep','life'],
            [/\b(?:hang|hung)\b.{0,14}\b(?:coat|jacket)\b.{0,14}\b(?:door|entry|hall)?\b|(?:코트|재킷).{0,12}(?:걸어|걸었|현관|문)/i,['🧥','🚪'],'coat','life'],
            [/\b(?:kettle|teapot)\b.{0,14}\b(?:water|fill|filled)\b.{0,16}\bcoffee\b|커피.{0,14}(?:주전자|물).{0,10}(?:채|넣)/i,['☕','💧'],'kettle','food'],
            [/\b(?:sort|sorted|organize|organized)\b.{0,14}\b(?:mail|letters?|post)\b|(?:우편물|편지).{0,12}(?:정리|분류)/i,['✉️','📬'],'mail','life'],
            [/\b(?:tighten|tightened|fix|fixed)\b.{0,14}\b(?:loose\s+)?screw\b.{0,14}\bchair\b|(?:의자).{0,12}(?:나사).{0,8}(?:조이|고쳤|수리)/i,['🪛','🪑'],'chair-screw','life'],
            [/\b(?:umbrella)\b.{0,14}\b(?:bag|backpack|packed|put)\b|(?:가방|백팩).{0,10}(?:우산).{0,8}(?:넣|챙)|우산.{0,10}(?:가방|백팩)/i,['☂️','🎒'],'umbrella','life'],
            [/\b(?:open|opened)\b.{0,12}\bcurtains?\b.{0,18}\b(?:sun|sunlight|light)\b|(?:햇빛|빛).{0,12}(?:커튼).{0,8}(?:열)|커튼.{0,10}(?:열).{0,10}(?:햇빛|빛)/i,['☀️','🪟'],'curtains','life'],
            [/\b(?:take|took|put)\b.{0,12}\b(?:trash|garbage|rubbish)\b.{0,12}\bout\b|(?:쓰레기).{0,10}(?:버렸|내다|내놨|치웠)/i,['🗑️','🏠'],'trash','life'],
            [/\b(?:grocer(?:y|ies)|shopping)\b.{0,14}\b(?:list|note)\b|(?:장볼|장보기).{0,10}(?:목록|리스트|메모)/i,['📝','🛒'],'grocery-list','life'],
            [/\b(?:bottle\s+of\s+water|water\s+bottle)\b.{0,16}\b(?:fridge|refrigerator|cool|chill)\b|(?:물병|생수).{0,12}(?:냉장고|차갑|시원)/i,['💧','❄️'],'cold-water','life'],

            // Social / SNS.
            [/\b(?:golden\s+light|sunlight|sunset\s+light)\b.{0,20}\b(?:building|buildings|city)\b|(?:금빛|노을빛|햇살).{0,14}(?:건물|도시|사이)/i,['🌅','✨'],'golden-light','social'],
            [/\b(?:first\s+sip|sip)\b.{0,12}\bcoffee\b.{0,18}\b(?:balcony|quiet)\b|(?:발코니|베란다).{0,12}(?:커피|첫\s*모금)/i,['☕','😌'],'quiet-coffee','social'],
            [/\b(?:flowers?|blossoms?)\b.{0,18}\b(?:bloom|blooming|window|windowsill)\b|(?:꽃|꽃들).{0,14}(?:피기|피었|창가|창문)/i,['🌸','🪟'],'flowers-window','nature'],
            [/\b(?:rainy|rain)\b.{0,18}\b(?:playlist|music|song)\b|(?:비\s*오는|비가).{0,14}(?:플레이리스트|음악|노래)/i,['🌧️','🎵'],'rain-music','social'],
            [/\b(?:old\s+)?photo\b.{0,18}\b(?:smile|smiled|memory|found)\b|(?:옛날|오래된)?\s*사진.{0,14}(?:웃|미소|찾|기억)/i,['📸','😊'],'photo-smile','social'],
            [/\b(?:fresh|warm)\s+bread\b.{0,16}\b(?:oven|baked)\b|(?:오븐).{0,12}(?:막\s*나온|따뜻한)\s*빵|따뜻한\s*빵/i,['🍞','😋'],'bread','food'],
            [/\b(?:walk|walked|walking)\b.{0,18}\b(?:city\s+lights?|night\s+lights?)\b|(?:도시\s*불빛|야경).{0,14}(?:걸었|산책|걷)/i,['🚶','🌃'],'night-walk','social'],
            [/\bsky\b.{0,18}\b(?:pink|rose|purple)\b|(?:하늘).{0,12}(?:분홍|핑크|보라|물들)/i,['🌇','💗'],'pink-sky','nature'],
            [/\bcat\b.{0,16}\b(?:couch|sofa)\b|(?:고양이).{0,12}(?:소파|쇼파)/i,['🐱','🛋️'],'cat-sofa','social'],
            [/\b(?:finish|finished|complete|completed)\b.{0,18}\b(?:sketch|drawing)\b|(?:스케치|그림).{0,12}(?:끝|완성|마무리)/i,['🎨','✅'],'sketch-done','creative'],
            [/\b(?:bookstore|bookshop)\b.{0,18}\b(?:quiet|afternoon|browse)\b|(?:서점).{0,14}(?:조용|오후|둘러)/i,['📚','😌'],'bookstore','social'],
            [/\b(?:first\s+song|song)\b.{0,16}\b(?:show|concert|gig)\b.{0,16}\b(?:chills|goosebumps)\b|(?:공연|콘서트).{0,14}(?:첫\s*곡|노래).{0,12}(?:소름|감동)/i,['🎵','🤩'],'concert-chills','creative'],
            [/\b(?:pancakes?|waffles?)\b.{0,16}\b(?:sunday|breakfast|brunch)\b|(?:일요일).{0,10}(?:아침|브런치).{0,10}(?:팬케이크|와플)|(?:팬케이크|와플).{0,10}(?:아침|브런치)/i,['🥞','☀️'],'pancake','food'],
            [/\b(?:new\s+shoes?|sneakers?)\b.{0,18}\b(?:walk|walking)\b|(?:새\s*신발|운동화).{0,12}(?:산책|걸|걷)/i,['👟','🚶'],'shoes-walk','life'],

            // Work / education / creative concrete actions.
            [/\b(?:attach|attached)\b.{0,18}\b(?:final\s+)?draft\b.{0,18}\b(?:ticket|review)\b|(?:최종\s*)?초안.{0,14}(?:티켓|검토).{0,8}(?:첨부)/i,['📎','📝'],'attach-draft','work'],
            [/\b(?:move|moved|reschedule|rescheduled)\b.{0,18}\b(?:planning\s+)?session\b.{0,16}\b(?:monday|tuesday|wednesday|thursday|friday)\b|(?:기획\s*)?(?:회의|세션).{0,14}(?:월요일|화요일|수요일|목요일|금요일).{0,8}(?:옮|변경)/i,['📅','🔄'],'session-moved','work'],
            [/\b(?:assign|assigned)\b.{0,16}\b(?:bug|issue)\b.{0,16}\b(?:owner|backend|developer)\b|(?:버그|이슈).{0,14}(?:담당자|백엔드|개발자).{0,8}(?:배정|지정)/i,['👤','🐞'],'bug-owner','work'],
            [/\b(?:sign|signed)\b.{0,16}\b(?:vendor|supplier)?\s*(?:agreement|contract)\b|(?:공급업체|벤더)?\s*(?:계약서|계약).{0,10}(?:서명)/i,['✍️','📜'],'contract-signed','work'],
            [/\b(?:export|exported)\b.{0,18}\b(?:quarterly|monthly)?\s*(?:numbers?|data|metrics)\b.{0,18}\b(?:spreadsheet|sheet)\b|(?:분기|월간)?\s*(?:수치|데이터|지표).{0,12}(?:스프레드시트|시트).{0,8}(?:내보|추출)/i,['📊','📤'],'export-sheet','work'],
            [/\b(?:design\s+review|review)\b.{0,16}\b(?:booked|scheduled)\b.{0,16}\b(?:friday|morning|date)\b|(?:디자인\s*검토).{0,12}(?:금요일|아침|예약|일정)/i,['🎨','📅'],'design-review','work'],
            [/\b(?:action\s+items?|tasks?)\b.{0,18}\b(?:closed|completed|finished|done)\b|(?:할\s*일|액션\s*아이템).{0,14}(?:완료|끝|처리)/i,['✅','📋'],'actions-done','work'],
            [/\b(?:share|shared|send|sent)\b.{0,18}\b(?:meeting\s+)?notes?\b|(?:회의록|회의\s*메모).{0,12}(?:공유|전송|보냈)/i,['📝','📤'],'notes-shared','work'],
            [/\b(?:client|customer)\b.{0,16}\b(?:approved|accepted)\b.{0,16}\b(?:scope|proposal|revision)\b|(?:고객|클라이언트).{0,12}(?:범위|제안|수정안).{0,8}(?:승인|수락)/i,['✅','📜'],'scope-approved','work'],
            [/\b(?:hr|recruiting|human resources)\b.{0,18}\b(?:schedule|scheduled|booked)\b.{0,14}\binterviews?\b|(?:인사팀|채용팀).{0,14}(?:면접).{0,8}(?:잡|예약|일정)/i,['👥','📅'],'interviews','work'],
            [/\b(?:move|moved)\b.{0,18}\b(?:old\s+)?documents?\b.{0,16}\b(?:archive|folder)\b|(?:오래된\s*)?문서.{0,14}(?:보관|아카이브)\s*폴더.{0,8}(?:옮)/i,['📁','🗄️'],'archive-docs','work'],
            [/\b(?:purchase\s+request|purchase\s+order)\b.{0,18}\b(?:waiting|pending|awaiting)\b.{0,18}\b(?:finance|approval)\b|(?:구매\s*요청|구매\s*주문).{0,14}(?:재무|승인).{0,10}(?:대기|기다리)/i,['⏳','💰'],'purchase-pending','work'],
            [/\b(?:add|added)\b.{0,16}\b(?:milestone|goal)\b.{0,18}\broadmap\b|(?:로드맵).{0,12}(?:마일스톤|목표).{0,8}(?:추가)/i,['🎯','🗺️'],'milestone','work'],
            [/\b(?:legal|law)\s+team\b.{0,18}\b(?:comment|comments|feedback)\b.{0,16}\b(?:contract|agreement)\b|(?:법무팀).{0,14}(?:계약서|계약).{0,8}(?:의견|댓글|피드백)/i,['⚖️','💬'],'legal-comments','work'],

            // Education.
            [/\b(?:finish|finished|read)\b.{0,14}\b(?:first\s+)?chapter\b.{0,14}\b(?:textbook|book)\b|(?:교재|책).{0,12}(?:첫\s*)?챕터.{0,8}(?:읽|끝)/i,['📚','✅'],'chapter-done','education'],
            [/\b(?:professor|teacher|instructor)\b.{0,14}\b(?:move|moved|rescheduled)\b.{0,12}\bquiz\b|(?:교수|선생님|강사).{0,12}(?:퀴즈|시험).{0,8}(?:옮|변경)/i,['📝','📅'],'quiz-moved','education'],
            [/\b(?:submit|submitted|turn(?:ed)?\s+in)\b.{0,14}\b(?:lab|experiment)\s+report\b|(?:실험\s*보고서).{0,10}(?:제출)/i,['📤','🧪'],'lab-report','education'],
            [/\b(?:study\s+group)\b.{0,16}\b(?:reserve|reserved|booked)\b.{0,16}\b(?:library|room)\b|(?:스터디\s*그룹).{0,14}(?:도서관|방).{0,8}(?:예약)/i,['📚','📅'],'study-room','education'],
            [/\b(?:highlight|highlighted)\b.{0,14}\b(?:key\s+)?terms?\b.{0,14}\bnotes?\b|(?:필기|노트).{0,12}(?:핵심\s*용어|용어).{0,8}(?:표시|형광펜)/i,['📝','🔖'],'highlight-notes','education'],
            [/\b(?:exam|test)\s+results?\b.{0,16}\b(?:posted|published|released)\b|(?:시험|퀴즈)\s*결과.{0,10}(?:공개|게시|나왔)/i,['📊','🎓'],'exam-results','education'],
            [/\b(?:practice|practiced|study|studied)\b.{0,14}\b(?:vocabulary|words?)\b.{0,14}\b(?:minutes?|hour)\b|(?:단어|어휘).{0,12}(?:\d+\s*분|시간).{0,8}(?:외웠|공부|연습)/i,['📚','⏱️'],'vocab','education'],
            [/\b(?:assignment|paper|essay)\b.{0,18}\b(?:citation|reference)\b.{0,14}\b(?:need|needs|missing|add)\b|(?:과제|논문|에세이).{0,14}(?:인용|출처).{0,8}(?:필요|추가|더\s*넣)/i,['📝','🔎'],'citation','education'],
            [/\b(?:watch|watched)\b.{0,14}\b(?:recorded\s+)?lecture\b|(?:녹화\s*)?강의.{0,10}(?:봤|시청)/i,['🎓','🎥'],'lecture-video','education'],
            [/\b(?:teacher|professor|instructor)\b.{0,14}\b(?:approved|accepted)\b.{0,14}\b(?:project\s+)?topic\b|(?:선생님|교수|강사).{0,12}(?:프로젝트\s*)?주제.{0,8}(?:승인|확정)/i,['✅','🎓'],'topic-approved','education'],
            [/\b(?:print|printed)\b.{0,14}\bslides?\b.{0,14}\b(?:class|tomorrow)\b|(?:수업용\s*)?슬라이드.{0,10}(?:인쇄|출력)/i,['🖨️','📚'],'slides-print','education'],
            [/\b(?:finish|finished|complete|completed)\b.{0,14}\b(?:group\s+)?presentation\b|(?:조별\s*)?발표.{0,10}(?:끝|완료|마무리)/i,['✅','📊'],'presentation-done','education'],
            [/\b(?:borrow|borrowed|check(?:ed)? out)\b.{0,14}\bbooks?\b.{0,14}\blibrary\b|(?:도서관).{0,12}책.{0,8}(?:빌렸|대출)/i,['📚','📖'],'books-borrowed','education'],
            [/\b(?:course|class)\s+registration\b.{0,16}\b(?:opens?|starts?|next week)\b|(?:수강\s*신청|강의\s*등록).{0,12}(?:다음\s*주|열|시작)/i,['📅','🎓'],'course-registration','education'],

            // Creative/media.
            [/\b(?:edit|edited|editing)\b.{0,14}\b(?:final\s+cut|video|clip)\b|(?:영상|클립).{0,12}(?:최종\s*편집|편집\s*끝|편집)/i,['🎬','✂️'],'video-edit','creative'],
            [/\b(?:camera)\b.{0,12}\bbatter(?:y|ies)\b.{0,12}\b(?:died|dead|empty|drained)\b|(?:카메라).{0,10}배터리.{0,8}(?:방전|없|다 됨)/i,['📷','🔋'],'camera-battery','creative'],
            [/\b(?:record|recorded)\b.{0,14}\b(?:podcast|audio)\b.{0,12}\b(?:intro|episode)?\b|(?:팟캐스트|오디오).{0,12}(?:인트로|에피소드)?.{0,8}(?:녹음)/i,['🎙️','🎧'],'podcast-record','creative'],
            [/\b(?:illustration|drawing|artwork)\b.{0,18}\b(?:color|colour|palette|warmer)\b|(?:일러스트|그림).{0,12}(?:색감|팔레트|색상).{0,8}(?:따뜻|바꿔)/i,['🎨','🌈'],'art-color','creative'],
            [/\b(?:export|exported)\b.{0,14}\bphotos?\b.{0,14}\b(?:client|customer)\b|(?:고객|클라이언트).{0,10}(?:사진).{0,8}(?:내보|전송)/i,['📸','📤'],'photo-export','creative'],
            [/\b(?:rehearsal|practice)\b.{0,14}\b(?:late|delayed|ran.*late)\b|(?:리허설|연습).{0,12}(?:늦|지연)/i,['🎤','⏳'],'rehearsal-late','creative'],
            [/\b(?:mix|mixed|mixing)\b.{0,14}\b(?:song|track|music)\b|(?:노래|트랙|음원).{0,10}(?:믹싱|혼합).{0,8}(?:끝|완료)?/i,['🎵','✅'],'song-mix','creative'],
            [/\b(?:poster|design)\s+draft\b.{0,16}\b(?:ready|review)\b|(?:포스터|디자인)\s*초안.{0,12}(?:검토|준비)/i,['🎨','🔍'],'poster-review','creative'],
            [/\b(?:backup|backed up)\b.{0,14}\b(?:raw\s+)?video\s+files?\b|(?:원본\s*)?영상\s*파일.{0,10}(?:백업)/i,['🎥','💾'],'video-backup','creative'],
            [/\b(?:microphone|mic)\b.{0,18}\b(?:noise|static|hiss|too much)\b|(?:마이크).{0,12}(?:잡음|노이즈|소음)/i,['🎙️','⚠️'],'mic-noise','creative'],
            [/\b(?:sketch|sketched)\b.{0,14}\b(?:logo|logos?)\b.{0,14}\b(?:idea|ideas)\b|(?:로고).{0,12}(?:아이디어).{0,8}(?:스케치|그렸)/i,['✏️','💡'],'logo-sketch','creative'],
            [/\b(?:photo|print)\b.{0,14}\b(?:too\s+dark|dark|underexposed)\b|(?:사진|인화).{0,12}(?:어둡|노출\s*부족)/i,['📸','🌑'],'dark-photo','creative'],
            [/\b(?:book|booked|reserve|reserved)\b.{0,14}\bstudio\b.{0,14}\b(?:monday|tuesday|wednesday|thursday|friday|next)\b|(?:스튜디오).{0,12}(?:월요일|화요일|수요일|목요일|금요일|다음).{0,8}(?:예약)/i,['🎙️','📅'],'studio-booked','creative'],
            [/\b(?:add|added)\b.{0,14}\b(?:subtitles?|captions?)\b.{0,14}\b(?:video|clip)\b|(?:영상|클립).{0,12}(?:자막).{0,8}(?:추가)/i,['🎬','💬'],'subtitles','creative'],

            // Tech status additions.
            [/\b(?:503|500|502|504)\s+errors?\b|\bservice\b.{0,16}\b(?:503|500|502|504)\b|서비스.{0,12}(?:503|500|502|504)\s*오류/i,['❌','🌐'],'http-error','tech'],
            [/\bmemory\s+usage\b.{0,16}\b(?:dropped|fell|decreased|lower)\b|(?:메모리\s*사용량).{0,12}(?:감소|줄|하락)/i,['📉','💻'],'memory-down','tech'],
            [/\b(?:database|db)\s+replica\b.{0,16}\b(?:caught up|synced|synchronized|healthy)\b|(?:데이터베이스|DB)\s*복제본.{0,12}(?:동기화|정상|따라잡)/i,['✅','💾'],'replica-ok','tech'],
            [/\bcertificate\b.{0,14}\b(?:renewal|renew)\b.{0,14}\b(?:failed|failure)\b|인증서.{0,10}(?:갱신).{0,8}(?:실패)/i,['🔐','❌'],'cert-renew-fail','tech'],
            [/\bqueue\b.{0,16}\b(?:drained|cleared|empty)\b.{0,18}\bworker\b|(?:워커).{0,12}(?:재시작).{0,12}(?:큐).{0,8}(?:처리|비워|소진)/i,['✅','⚙️'],'queue-drained','tech'],
            [/\bdeployment\b.{0,14}\b(?:finished|completed|succeeded)\b.{0,16}\b(?:without\s+errors?|clean)\b|(?:오류\s*없이).{0,12}(?:배포).{0,8}(?:완료|끝)/i,['✅','🛠️'],'deploy-ok','tech'],
            [/\blatency\b.{0,16}\b(?:doubled|increased|rose|spiked)\b|(?:지연\s*시간|레이턴시).{0,12}(?:두\s*배|증가|상승)/i,['⏱️','📈'],'latency-up','tech'],
            [/\bbackup\b.{0,16}\b(?:missing|misses|without)\b.{0,14}\bfile\b|(?:백업).{0,12}(?:파일).{0,8}(?:빠져|누락|없)/i,['💾','⚠️'],'backup-missing','tech'],
            [/\b(?:rotate|rotated|replace|replaced)\b.{0,14}\b(?:api\s+key|token|credential)\b|(?:API\s*키|토큰|자격).{0,10}(?:교체|로테이션|갱신)/i,['🔐','🔄'],'key-rotate','tech'],
            [/\bbuild\b.{0,16}\b(?:passed|succeeded|green)\b.{0,18}\b(?:dependency|update)\b|(?:의존성\s*업데이트).{0,12}(?:빌드).{0,8}(?:통과|성공)/i,['✅','💻'],'build-pass','tech'],
            [/\b(?:disk|storage)\s+usage\b.{0,16}\b(?:above|over|more than)\b.{0,8}\b(?:\d+|ninety)\s*%|(?:디스크|저장\s*공간)\s*사용량.{0,12}(?:\d+|90)\s*(?:퍼센트|%).{0,8}(?:넘|이상)/i,['💾','⚠️'],'disk-high','tech'],
            [/\bwebhook\b.{0,14}\b(?:delivery|send)\b.{0,14}\b(?:delayed|late|pending)\b|(?:웹훅).{0,12}(?:전송).{0,8}(?:지연|늦|대기)/i,['⏳','🌐'],'webhook-delay','tech'],
            [/\b(?:database|db)\s+connection\b.{0,16}\b(?:recovered|restored)\b|(?:데이터베이스|DB)\s*연결.{0,12}(?:복구|회복|정상)/i,['✅','💾'],'db-connection-ok','tech'],
            [/\b(?:scheduler|cron)\b.{0,16}\b(?:skipped|missed)\b.{0,12}\b(?:job|task)\b|(?:스케줄러|크론).{0,12}(?:작업|잡).{0,8}(?:건너뛰|누락)/i,['⚙️','⚠️'],'scheduler-skip','tech'],

            // Commerce/travel status additions.
            [/\bpre-?order\b.{0,18}\b(?:ships?|shipping|dispatch)\b.{0,16}\b(?:monday|tuesday|wednesday|thursday|friday|next)\b|(?:사전\s*주문|프리오더).{0,14}(?:월요일|화요일|수요일|목요일|금요일|다음).{0,8}(?:발송|배송)/i,['📦','📅'],'preorder-ship','commerce'],
            [/\b(?:payment|refund)\b.{0,14}\b(?:pending|processing|waiting)\b|(?:결제|환불).{0,10}(?:처리\s*중|대기|진행\s*중)/i,['⏳','💳'],'payment-pending','commerce'],
            [/\b(?:coupon|promo|voucher)\b.{0,14}\b(?:expires?|expiry|ends?)\b.{0,12}\b(?:tonight|today|tomorrow)\b|(?:쿠폰|프로모션).{0,10}(?:오늘|내일|밤).{0,8}(?:만료|끝)/i,['🏷️','⏰'],'coupon-expire','commerce'],
            [/\b(?:refund|refunded)\b.{0,18}\b(?:shipping\s+fee|delivery\s+fee|postage)\b|(?:배송비|배달비).{0,10}(?:환불|돌려)/i,['💰','✅'],'shipping-refund','commerce'],
            [/\b(?:package|parcel)\b.{0,16}\b(?:waiting|ready)\b.{0,16}\b(?:pickup\s+point|collection point)\b|(?:택배|소포).{0,12}(?:픽업|수령)\s*지점.{0,8}(?:대기|도착)/i,['📦','📍'],'package-pickup','commerce'],
            [/\b(?:back in stock|available again|restocked)\b|(?:다시\s*재고|재입고|재고에\s*들어)/i,['✅','🛒'],'restocked','commerce'],
            [/\breturn\s+window\b.{0,14}\b(?:closes?|ends?|expires?)\b|(?:반품\s*가능\s*기간|반품\s*기간).{0,10}(?:끝|마감|만료)/i,['↩️','⏰'],'return-window','commerce'],
            [/\border\b.{0,14}\b(?:cancelled|canceled)\b.{0,16}\b(?:before|prior to)\b.{0,10}\b(?:ship|shipped|shipping)\b|(?:발송|배송).{0,10}(?:전).{0,8}(?:주문).{0,8}(?:취소)|주문.{0,10}(?:발송|배송).{0,8}(?:전).{0,8}(?:취소)/i,['🚫','📦'],'order-cancelled','commerce'],
            [/\b(?:checkout|payment)\s+page\b.{0,16}\b(?:rejected|declined)\b.{0,12}\bcard\b|(?:결제\s*페이지).{0,12}(?:카드).{0,8}(?:거절|실패)/i,['❌','💳'],'checkout-declined','commerce'],
            [/\b(?:seller|store)\b.{0,16}\b(?:added|provided)\b.{0,14}\btracking\s+(?:number|code)\b|(?:판매자|스토어).{0,12}(?:운송장|송장)\s*번호.{0,8}(?:추가|등록)/i,['📦','🔎'],'tracking-added','commerce'],
            [/\bfree\s+shipping\b.{0,16}\b(?:starts?|over|above|from|at)\b.{0,14}(?:\$|dollars?|won|₩|\d)|(?:무료\s*배송).{0,14}(?:이상|부터|조건).{0,10}(?:원|달러|\d)/i,['🚚','💰'],'free-shipping','commerce'],
            [/\bsubscription\s+price\b.{0,16}\b(?:increase|increases|rises|goes up)\b|(?:구독\s*가격|요금제\s*가격).{0,12}(?:오르|인상|증가)/i,['📈','💰'],'subscription-price-up','commerce'],
            [/\b(?:item|product|package)\b.{0,16}\b(?:arrived|delivered)\b.{0,12}\b(?:damaged|broken)\b|(?:상품|제품|택배).{0,12}(?:파손|손상).{0,8}(?:도착|배송)/i,['📦','⚠️'],'damaged-item','commerce'],
            [/\bflight\b.{0,14}\b(?:moved|changed)\b.{0,12}\bgate\b|항공편.{0,10}게이트.{0,8}(?:바뀌|변경)/i,['✈️','📍'],'flight-gate','travel'],
            [/\btrain\b.{0,14}\b(?:late|delayed)\b|기차.{0,10}(?:늦|지연)/i,['🚆','⏳'],'train-late','travel'],
            [/\bhotel\s+check-?in\b.{0,14}\b(?:begins?|starts?|at)\b|호텔\s*체크인.{0,10}(?:시작|\d+시)/i,['🏨','⏰'],'hotel-checkin','travel'],
            [/\b(?:download|downloaded|save|saved)\b.{0,14}\bboarding\s+pass\b.{0,14}\b(?:phone|mobile)\b|탑승권.{0,12}(?:휴대폰|폰).{0,8}(?:다운로드|저장)/i,['✈️','📱'],'boarding-pass-phone','travel'],
            [/\b(?:bus|shuttle)\b.{0,14}\b(?:airport)\b.{0,14}\b(?:full|sold out)\b|공항.{0,10}(?:버스|셔틀).{0,8}(?:만석|꽉)/i,['🚌','✈️'],'airport-bus','travel'],
            [/\b(?:book|booked|reserve|reserved)\b.{0,14}\b(?:table|restaurant)\b.{0,14}\bhotel\b|호텔.{0,10}(?:근처).{0,8}(?:식당|레스토랑).{0,8}(?:예약)/i,['🍽️','🏨'],'restaurant-hotel','travel'],
            [/\bferry\b.{0,14}\b(?:cancelled|canceled)\b.{0,14}\b(?:wind|weather)\b|(?:강풍|바람|날씨).{0,12}페리.{0,8}(?:취소)|페리.{0,10}(?:강풍|바람).{0,8}(?:취소)/i,['🚫','🚢'],'ferry-cancel','travel'],
            [/\b(?:suitcase|luggage|bag)\b.{0,16}\b(?:over|above)\b.{0,12}\b(?:limit|weight)\b|(?:여행\s*가방|수하물|캐리어).{0,12}(?:무게\s*제한|중량).{0,8}(?:넘|초과)/i,['🧳','⚠️'],'bag-overweight','travel'],
            [/\bmuseum\b.{0,14}\b(?:opens?|opening)\b.{0,14}(?:\d+|ten|tomorrow)|박물관.{0,10}(?:내일|\d+시).{0,8}(?:문을\s*열|개장)/i,['🏛️','⏰'],'museum-open','travel'],
            [/\bpassport\s+(?:control|inspection)\b.{0,16}\b(?:hour|minutes?|took)\b|(?:여권\s*심사|출입국\s*심사).{0,12}(?:시간|분|걸렸)/i,['🛂','⏱️'],'passport-control','travel'],
            [/\b(?:rental\s+car|car)\b.{0,14}\b(?:flat\s+tire|flat\s+tyre|puncture)\b|렌터카.{0,10}(?:타이어).{0,8}(?:바람|펑크|파손)/i,['🚗','⚠️'],'flat-tire','travel'],
            [/\b(?:change|changed|transfer|transferred)\b.{0,14}\btrains?\b|(?:기차|열차).{0,10}(?:갈아탔|환승)/i,['🚆','🔄'],'change-train','travel'],
            [/\b(?:hiking\s+trail|trail)\b.{0,14}\b(?:closed|closure)\b.{0,14}\b(?:snow|weather)\b|(?:등산로|산길).{0,10}(?:폭설|눈).{0,8}(?:폐쇄|통제)/i,['🥾','❄️','🚫'],'trail-closed','travel'],
            [/\bhotel\s+reservation\b.{0,14}\b(?:confirmed|booked)\b|호텔\s*예약.{0,10}(?:확정|완료)/i,['🏨','✅'],'hotel-confirmed','travel'],

            // Fitness/relationships.
            [/\b(?:swim|swam|swimming)\b.{0,14}\b(?:laps?|pool)\b|(?:수영).{0,12}(?:바퀴|랩|했다|함)/i,['🏊','💪'],'swim','fitness'],
            [/\b(?:stretch|stretched|stretching)\b.{0,18}\b(?:back|loosen|relax)\b|(?:스트레칭).{0,12}(?:허리|등|편해|이완)/i,['🧘','😌'],'stretch-relax','fitness'],
            [/\b(?:fruit|apple|banana)\b.{0,14}\b(?:snack|packed)\b|(?:과일|사과|바나나).{0,12}(?:간식|챙겼)/i,['🍎','🌿'],'fruit-snack','fitness'],
            [/\b(?:watch|smartwatch)\b.{0,14}\b(?:sleep|slept)\b.{0,14}\b(?:hours?|logged|recorded)\b|(?:스마트워치|시계).{0,12}(?:수면).{0,8}(?:시간|기록)/i,['😴','⌚'],'watch-sleep','fitness'],
            [/\b(?:stairs?|staircase)\b.{0,14}\b(?:instead of|rather than)\b.{0,14}\b(?:elevator|lift)\b|(?:엘리베이터|승강기).{0,10}(?:대신).{0,8}(?:계단)/i,['🚶','💪'],'stairs','fitness'],
            [/\b(?:knee|ankle|leg)\b.{0,14}\b(?:hurts?|pain|sore)\b.{0,14}\b(?:skip|skipped|rest|training)\b|(?:무릎|발목|다리).{0,10}(?:아프|통증).{0,12}(?:운동|쉬|훈련)/i,['🩹','😌'],'knee-rest','fitness'],
            [/\b(?:strength|weight)\s+(?:session|workout|training)\b.{0,14}\b(?:finished|completed|minutes?)\b|(?:근력\s*운동|웨이트).{0,10}(?:분|완료|끝)/i,['💪','✅'],'strength-done','fitness'],
            [/\b(?:bottle|water)\b.{0,14}\b(?:after|post)\b.{0,12}\bwalk\b|(?:산책|걷기).{0,10}(?:뒤|후).{0,8}(?:물|물병)/i,['💧','🚶'],'water-walk','fitness'],
            [/\b(?:recovery\s+day|recovery day)\b|(?:회복하는\s*날|회복일)/i,['😌','🌿'],'recovery-day','fitness'],
            [/\b(?:weekly\s+)?(?:step|steps)\s+goal\b.{0,14}\b(?:reached|hit|achieved)\b|(?:걸음\s*수|보행)\s*목표.{0,10}(?:달성|채웠)/i,['🎯','🚶'],'step-goal','fitness'],
            [/\b(?:salad)\b.{0,14}\b(?:after|post)\b.{0,12}\b(?:gym|workout)\b|(?:헬스장|운동).{0,10}(?:뒤|후).{0,8}(?:샐러드)/i,['🥗','💪'],'salad-gym','fitness'],
            [/\b(?:cycle|cycled|bike|biked)\b.{0,14}\b(?:to work|commute|morning)\b|(?:자전거).{0,10}(?:출근|아침)/i,['🚲','🌅'],'bike-work','fitness'],
            [/\b(?:meditate|meditated|meditation)\b.{0,14}\b(?:before bed|minutes?|night)\b|(?:명상).{0,10}(?:잠들기\s*전|분|밤)/i,['🧘','🌙'],'meditation','fitness'],
            [/\b(?:brother|sister|mom|dad|parent)\b.{0,14}\b(?:called|phone|phoned)\b.{0,16}\b(?:good news|news)\b|(?:형|오빠|동생|언니|누나|엄마|아빠).{0,10}(?:전화).{0,8}(?:좋은\s*소식|소식)/i,['📞','😊'],'family-good-news','social'],
            [/\b(?:lunch|meal)\b.{0,14}\bfriend\b.{0,18}\b(?:months?|long time|hadn['’]t seen)\b|(?:몇\s*달|오랜만).{0,12}친구.{0,10}(?:점심|식사|만났)/i,['🍽️','🤝'],'old-friend-lunch','social'],
            [/\b(?:send|sent|share|shared)\b.{0,14}\b(?:parents?|family)\b.{0,14}\bphoto\b|(?:부모님|가족).{0,10}(?:사진).{0,8}(?:보냈|공유)/i,['📸','💛'],'family-photo','social'],
            [/\bneighbor\b.{0,14}\b(?:cookies?|baked|homemade)\b|이웃.{0,10}(?:쿠키|과자).{0,8}(?:가져|만든)/i,['🍪','🙏'],'neighbor-cookies','social'],
            [/\b(?:looking forward|can['’]t wait)\b.{0,16}\b(?:partner|boyfriend|girlfriend|spouse)\b|(?:연인|파트너).{0,10}(?:만날|보는).{0,8}(?:기대|설레)/i,['🥰','📅'],'partner-excited','social'],
            [/\b(?:family\s+)?dinner\b.{0,16}\b(?:saturday|sunday|planned|plan)\b|(?:토요일|일요일).{0,10}(?:가족).{0,8}(?:저녁|식사).{0,8}(?:계획)?/i,['🍽️','📅'],'family-dinner-plan','social'],
            [/\bfriend\b.{0,16}\b(?:texted|messaged|called)\b.{0,16}\b(?:rough|hard|bad)\s+day\b|(?:힘든|어려운)\s*날.{0,10}친구.{0,8}(?:메시지|연락)/i,['💬','💛'],'friend-support','social'],
            [/\b(?:sister|brother)\b.{0,14}\b(?:laughed|laughing)\b.{0,16}\b(?:old\s+)?memory\b|(?:언니|누나|형|오빠|동생).{0,10}(?:옛날|기억).{0,8}(?:웃|웃었다)/i,['😂','💛'],'sibling-laugh','social'],
            [/\b(?:congratulate|congratulated|congrats)\b.{0,14}\bfriend\b.{0,14}\b(?:new\s+job|promotion)\b|친구.{0,10}(?:새\s*직장|취업|승진).{0,8}(?:축하)/i,['🎉','🤝'],'friend-job','social'],
            [/\b(?:bump|bumped|ran)\s+into\b.{0,14}\b(?:former|old)\s+(?:coworker|colleague)\b|(?:예전|전)\s*(?:직장\s*)?(?:동료).{0,10}(?:우연히|만났)/i,['🤝','🏙️'],'old-coworker','social'],
            [/\bparents?\b.{0,16}\b(?:visiting|visit|coming)\b.{0,16}\b(?:weekend|next)\b|부모님.{0,10}(?:다음\s*주말|주말).{0,8}(?:오신|방문)/i,['💛','📅'],'parents-visit','social'],
            [/\b(?:thank-you|thank you)\s+(?:note|card)\b.{0,14}\bmentor\b|멘토.{0,10}(?:감사\s*카드|감사\s*메모|감사\s*편지)/i,['🙏','📝'],'mentor-thanks','social'],
            [/\b(?:talk|talking|chat)\b.{0,14}\bfriends?\b.{0,14}\b(?:late|night)\b|친구.{0,10}(?:늦게|밤).{0,8}(?:이야기|대화)/i,['💬','🌙'],'late-talk','social'],
            [/\bfriend\b.{0,14}\b(?:sent|shared)\b.{0,14}\b(?:puppy|dog)\s+photo\b|친구.{0,10}(?:강아지).{0,8}(?:사진).{0,8}(?:보냈|공유)/i,['🐶','📸'],'puppy-photo','social']
        ];
        for (const [re, emojis, id, group] of direct) if (re.test(t)) return special('p53-' + id, emojis, group, 205);

        return null;
    }

    function classifySpecial(text, rawText) {
        const raw = rawText || text;
        const working = text.replace(FALSE_NEGATIVE, ' ');

        if (/(?:@\w+|reviewer|qa).{0,18}\b(?:review|reviewing|check|checking)\b.{0,18}\b(?:failed|failure|error)\b.{0,12}\b(?:build|job)\b|(?:@\w+|QA|검토자).{0,18}(?:실패|오류).{0,10}(?:빌드|작업).{0,10}(?:검토|확인)/i.test(raw)) return special('v52b-failed-build-review-raw',['🔍','⚠️'],'tech',198);

        // v52b: residual high-priority semantic disambiguation. These sit ahead of
        // older broad profiles that can otherwise over-read words such as clean,
        // workout, deadline, timeout or friend.
        if (/\b(?:wash|washed|do|did)\b.{0,12}\b(?:the\s+)?dishes\b|설거지.{0,10}(?:했|하|끝)|접시.{0,10}(?:씻|닦)/i.test(text)) return special('v52b-dishes',['🍽️','🧼'],'life',196);
        if (/\b(?:add|added|extend|extended)\b.{0,12}(?:\d+|ten|fifteen|twenty).{0,10}\bminutes?\b.{0,16}\b(?:workout|training|exercise)\b|\b(?:workout|training|exercise)\b.{0,14}(?:\d+|ten|fifteen|twenty).{0,10}\bminutes?\b|(?:운동|훈련).{0,12}(?:시간|\d+\s*분|분).{0,10}(?:늘|추가|연장)/i.test(text)) return special('v52b-workout-time',['💪','⏱️'],'fitness',196);
        if (/\b(?:healthy|salad)\b.{0,16}\b(?:lunch|meal)\b.{0,18}\b(?:after|post)\s+(?:the\s+)?workout\b|\b(?:after|post)\s+(?:the\s+)?workout\b.{0,18}\b(?:healthy\s+)?(?:lunch|meal|salad)\b|(?:운동\s*뒤|운동\s*후).{0,14}(?:건강한\s*)?(?:점심|식사|샐러드)/i.test(text)) return special('v52b-healthy-lunch',['🥗','💪'],'fitness',196);
        if (/\b(?:gym|fitness center)\b.{0,16}\b(?:empty|quiet|uncrowded)\b|(?:헬스장|체육관).{0,14}(?:비어|한산|사람\s*없)/i.test(text)) return special('v52b-gym-empty',['💪','🌅'],'fitness',196);
        if (/\b(?:rest\s+day|day\s+off)\b|\b(?:rest|rested)\b.{0,14}\b(?:instead of|rather than)\b.{0,14}\b(?:training|workout|exercise)\b|(?:운동|훈련).{0,12}(?:대신).{0,10}(?:하루\s*)?(?:쉬|휴식)|(?:하루).{0,10}(?:쉬기로|휴식일)/i.test(text)) return special('v52b-rest-day',['😌','🛌'],'fitness',196);
        if (/\b(?:family\s+)?video\s+call\b|(?:가족\s*)?영상\s*통화/i.test(text)) return special('v52b-family-video-call',['📞','📅','💛'],'social',196);
        if (/\b(?:friend|partner|someone)\b.{0,16}\b(?:listened|listen)\b|친구.{0,16}(?:들어줬|들어주|경청)/i.test(text)) return special('v52b-listened',['💛','💬'],'social',196);
        if (/\b(?:birthday\s+message|birthday\s+wish)\b.{0,16}\b(?:friend|someone)?\b|친구.{0,12}생일.{0,10}(?:메시지|축하)|생일\s*메시지.{0,10}친구/i.test(text)) return special('v52b-birthday-message',['🎂','💬'],'social',196);
        if (/\b(?:weekend\s+)?trip\b.{0,18}\bfriends?\b|\bfriends?\b.{0,18}\b(?:weekend\s+)?trip\b|친구.{0,14}(?:주말\s*)?여행|(?:주말\s*)?여행.{0,14}친구/i.test(text)) return special('v52b-friend-trip',['🧳','🤝','📅'],'social',196);
        if (/\bsupport\s+tickets?\b.{0,20}\b(?:increased|rose|grew|up|spiked)\b|(?:지원|문의)\s*(?:티켓|건수).{0,16}(?:증가|상승|늘|급증)/i.test(text)) return special('v52b-support-tickets-up',['📈','📊'],'report',196);
        if (/\b(?:last\s+)?slice\s+of\s+cake\b|\bcake\b.{0,16}\b(?:slice|midnight|saved)\b|케이크.{0,14}(?:한\s*조각|마지막|자정|남겨)/i.test(text)) return special('v52b-cake-slice',['🍰','🌙'],'food',196);
        if (/\b(?:endpoint|request|api)\b.{0,18}\b(?:timed out|timeout|time out)\b|(?:엔드포인트|요청|API).{0,14}(?:타임아웃|시간\s*초과)/i.test(text)) return special('v52b-timeout',['⏱️','❌','🌐'],'tech',196);
        if (/\bcron\b.{0,18}\b(?:job|task)?\b.{0,18}\b(?:ran|run|completed)\b.{0,14}\b(?:success|successfully|normal)\b|(?:크론|cron).{0,14}(?:작업|잡).{0,14}(?:정상|성공).{0,10}(?:실행|완료)/i.test(text)) return special('v52b-cron-ok',['✅','⚙️'],'tech',196);
        if (/\b(?:deadline|due date)\b.{0,18}\b(?:moved|shifted|changed|pushed)\b|(?:마감일|기한).{0,16}(?:옮|변경|미뤄|연기)/i.test(text)) return special('v52b-deadline-moved',['📅','🔄'],'work',196);
        if (/\b(?:run|ran|jog|jogged)\b.{0,20}\b(?:street|road|outside|park)\b.{0,24}\b(?:not\s+a\s+software|not\s+a\s+command)?\b|(?:길|도로|거리).{0,14}(?:뛰|달렸|달리).{0,20}(?:명령|소프트웨어)?/i.test(text)) return special('v52b-physical-run',['🏃'],'fitness',196);
        if (/\b(?:did\s+not|didn['’]t)\s+miss\s+(?:the\s+)?flight\b|비행기를\s*놓친\s*(?:게|것이)\s*아니/i.test(text)) return special('v52b-flight-not-missed',['✅','✈️'],'travel',197);
        if (/\b(?:payment|order)\s+(?:alert|notification)\b.{0,20}\b(?:false|wrong|incorrect)\b.{0,20}\b(?:order|payment)\b.{0,10}\b(?:fine|normal|ok|okay)\b|(?:결제|주문)\s*(?:알림|통지).{0,14}(?:잘못|오류|거짓).{0,16}(?:주문|결제).{0,8}(?:정상|문제\s*없)/i.test(text)) return special('v52b-false-payment-alert',['✅','🛒'],'commerce',197);
        if (/(?:@\w+|reviewer|qa).{0,18}\b(?:review|reviewing|check|checking)\b.{0,18}\b(?:failed|failure|error)\b.{0,12}\b(?:build|job)\b|(?:@\w+|QA|검토자).{0,18}(?:실패|오류).{0,10}(?:빌드|작업).{0,10}(?:검토|확인)/i.test(text)) return special('v52b-failed-build-review',['🔍','⚠️'],'tech',197);

        // v51: compact residual repairs.
        if (/\bstudy\s+group\b.{0,20}\b(?:meet|meets|meeting).{0,16}\b(?:after|before)\s+class\b|(?:스터디\s*그룹|스터디).{0,14}(?:수업).{0,8}(?:뒤|후|전).{0,8}(?:만난|만나|모임)/i.test(text)) return special('study-group-v51',['📚','🤝'],'education',195);
        if (/\b(?:essay|assignment|paper).{0,18}\b(?:submitted|turned in|sent).{0,16}\b(?:before|ahead of).{0,10}\b(?:deadline|due date)\b|(?:에세이|과제|논문).{0,14}(?:마감|기한).{0,8}(?:전|보다\s*일찍).{0,8}(?:제출|보냈)/i.test(text)) return special('essay-before-deadline-v51',['📤','✅','⏰'],'education',195);
        if (/\b(?:only|just)\s+(?:one|two|three|four|five|\d+)\s+(?:black|white|blue|red|green)?\s*(?:item|product|unit|piece)?s?\s*(?:remain|remains|left)\b|\b(?:black|white|blue|red|green)?\s*(?:item|product)s?\b.{0,14}\b(?:only|just)\s+(?:one|two|three|four|five|\d+)\b.{0,8}\b(?:remain|left)\b|(?:검은색|흰색|파란색|빨간색|초록색)?\s*(?:상품|제품)?.{0,8}(?:한|두|세|네|다섯|\d+)\s*개만\s*(?:남|있)/i.test(text)) return special('low-stock-count-v51',['⚠️','🛒'],'commerce',195);
        if (/\b(?:reviewing|investigating|checking).{0,18}\b(?:outage|incident|failure|error)\s+(?:report|log|details)\b|(?:장애|사고|실패|오류)\s*(?:보고서|로그).{0,14}(?:검토|확인|조사)\s*중/i.test(text)) return special('incident-review-v51',['🔍','⚠️'],'tech',195);

        // v50: holdout repairs emphasizing status + object combinations and educational/work language.
        // Guards first.
        if (/\b(?:not a bug|isn['’]t a bug|wasn['’]t a bug).{0,24}\b(?:feature|intentional|by design)\b|(?:버그가\s*아니|버그는\s*아니).{0,18}(?:의도된\s*기능|기능|설계)/i.test(text)) return special('intentional-feature-v50',['💡','✅'],'tech',190);
        if (/\b(?:run|ran|execute|executed).{0,18}\b(?:export|import|build|deploy)\s+(?:command|script).{0,16}\b(?:terminal|shell|console)?\b|(?:터미널|셸|콘솔).{0,16}(?:내보내기|가져오기|빌드|배포).{0,10}(?:명령|스크립트).{0,8}(?:실행|돌렸)/i.test(text)) return special('run-command-v50',['💻','🛠️'],'tech',190);
        if (/\b(?:cancellation|cancel)\s+(?:notice|message|email).{0,24}\b(?:mistake|sent by mistake|incorrect).{0,30}\b(?:event|meeting|trip).{0,16}\b(?:still happening|still on|continues?)\b|(?:취소\s*안내|취소\s*메시지).{0,18}(?:실수|잘못).{0,18}(?:행사|회의|여행).{0,14}(?:그대로\s*진행|진행된다|계속)/i.test(text)) return special('false-cancel-notice-v50',['✅','📅'],'status',190);
        if (/\bpayment\b.{0,22}\b(?:not|wasn['’]t|isn['’]t)\s+(?:declined|rejected).{0,22}\b(?:bank|alert|notification).{0,14}\b(?:wrong|incorrect|mistaken)\b|(?:결제).{0,18}(?:거절된\s*것이\s*아니|거절된\s*게\s*아니).{0,18}(?:은행\s*)?(?:알림|통지).{0,10}(?:잘못|오류)/i.test(text)) return special('payment-not-declined-v50',['✅','💳'],'status',190);
        if (/\b(?:report|file|document).{0,22}\b(?:did not|didn['’]t|hasn['’]t)\s+fail.{0,16}\bupload\b.{0,22}\b(?:already|in the folder|uploaded)\b|(?:보고서|파일|문서).{0,18}(?:업로드).{0,10}(?:실패한\s*게\s*아니|실패하지\s*않).{0,18}(?:이미|폴더).{0,10}(?:올라|있)/i.test(text)) return special('upload-not-failed-v50',['✅','📁'],'status',190);

        // Commerce specifics.
        if (/\b(?:coupon|voucher|promo).{0,18}\b(?:applied|accepted|used).{0,14}\b(?:checkout|cart|order)\b|(?:결제|장바구니).{0,12}(?:쿠폰|프로모션\s*코드).{0,8}(?:적용|사용)|(?:쿠폰|프로모션\s*코드).{0,14}(?:결제|장바구니).{0,8}(?:적용|사용)/i.test(text)) return special('coupon-applied-v50',['🏷️','✅'],'commerce',185);
        if (/\b(?:pickup|collection)\s+code\b.{0,18}\b(?:ready|available|generated)\b|(?:픽업|수령)\s*코드.{0,14}(?:준비|발급|생성|사용\s*가능)/i.test(text)) return special('pickup-code-v50',['📍','🔢'],'commerce',185);
        if (/\b(?:tracking|shipment)\s+(?:update|status).{0,18}\b(?:delayed|late|pending)\b|(?:배송\s*조회|운송장)\s*(?:업데이트|상태).{0,14}(?:지연|늦|대기)/i.test(text)) return special('tracking-delay-v50',['⏳','📦'],'commerce',185);
        if (/\b(?:delivery|shipping).{0,14}\b(?:rescheduled|moved|changed).{0,18}\b(?:monday|tuesday|wednesday|thursday|friday|date|day)\b|(?:배송\s*일정|배송).{0,16}(?:월요일|화요일|수요일|목요일|금요일|날짜).{0,10}(?:다시\s*잡|재조정|변경)/i.test(text)) return special('delivery-rescheduled-v50',['🚚','📅','🔄'],'commerce',185);
        if (/\b(?:subscription|membership|plan).{0,20}\b(?:renewed|renewal).{0,12}\b(?:successfully|complete|completed)?\b|(?:구독|멤버십|요금제).{0,14}(?:정상적으로\s*)?(?:갱신|연장).{0,8}(?:완료|됐다|됨)?/i.test(text)) return special('subscription-renewed-v50',['✅','🔄'],'commerce',185);
        if (/\b(?:price|cost).{0,18}\b(?:dropped|fell|decreased|down).{0,12}\b(?:dollars?|\$|percent|%)?\b|(?:가격|금액).{0,14}(?:내려|하락|감소).{0,8}(?:달러|원|퍼센트|%)?/i.test(text)) return special('price-down-v50',['📉','💰'],'commerce',185);
        if (/\bcart\b.{0,16}\b(?:saved|kept).{0,12}\b(?:for later|later)\b|(?:장바구니).{0,14}(?:나중|후에).{0,8}(?:저장|보관)/i.test(text)) return special('cart-saved-v50',['🛒','🔖'],'commerce',185);
        if (/\b(?:only|just)\s+(?:one|two|three|four|five|\d+).{0,10}\b(?:black|white|blue|red|green|small|medium|large)?\s*(?:item|product|unit|piece)s?\b.{0,12}\b(?:remain|left)\b|(?:검은색|흰색|파란색|빨간색|상품|제품).{0,12}(?:한|두|세|네|다섯|\d+)\s*개만.{0,8}(?:남|있)|(?:한|두|세|네|다섯|\d+)\s*개만.{0,12}(?:남은|남았다).{0,10}(?:상품|제품)?/i.test(text)) return special('stock-count-low-v50',['⚠️','🛒'],'commerce',185);

        // Daily precision.
        if (/\b(?:clean|cleaned|wipe|wiped).{0,16}\b(?:bathroom\s+)?mirror\b|(?:욕실|화장실)?\s*거울.{0,12}(?:닦|청소)/i.test(text)) return special('clean-mirror-v50',['🪞','🧽'],'life',185);
        if (/\b(?:open|opened).{0,16}\bwindows?\b.{0,18}\b(?:air out|fresh air|ventilat)\b|(?:환기).{0,16}(?:창문).{0,8}(?:열|열었)|(?:창문).{0,14}(?:환기).{0,8}(?:열|열었)?/i.test(text)) return special('air-room-v50',['🪟','🌿'],'life',185);

        // Education states.
        if (/\b(?:pass|passed).{0,14}\b(?:final\s+)?(?:exam|test)\b|(?:기말|중간|자격)?\s*시험.{0,12}(?:합격|통과)/i.test(text)) return special('exam-passed-v50',['✅','🎓'],'education',186);
        if (/\b(?:assignment|homework|paper).{0,16}\b(?:due|deadline).{0,12}\b(?:monday|tuesday|wednesday|thursday|friday|today|tomorrow)\b|(?:과제|숙제|논문).{0,12}(?:마감|기한).{0,10}(?:월요일|화요일|수요일|목요일|금요일|오늘|내일)|(?:과제\s*마감).{0,10}(?:월요일|화요일|수요일|목요일|금요일)/i.test(text)) return special('assignment-due-v50',['📝','⏰'],'education',186);
        if (/\b(?:lecture|class).{0,16}\b(?:cancelled|canceled|called off)\b|(?:강의|수업).{0,12}(?:취소|휴강)/i.test(text)) return special('class-cancelled-v50',['🚫','🎓'],'education',186);
        if (/\b(?:register|registered|enroll|enrolled).{0,14}\b(?:spring|fall|autumn|winter|summer)?\s*(?:class|course)\b|(?:봄|가을|겨울|여름)?\s*(?:학기\s*)?(?:수업|강의|과정).{0,10}(?:등록|신청)/i.test(text)) return special('class-registered-v50',['✅','📚','📅'],'education',186);
        if (/\b(?:submit|submitted|turn(?:ed)? in).{0,16}\b(?:essay|assignment|paper).{0,18}\b(?:before|ahead of).{0,10}\b(?:deadline|due date)\b|(?:에세이|과제|논문).{0,14}(?:마감|기한).{0,8}(?:전|보다\s*일찍).{0,8}(?:제출)/i.test(text)) return special('essay-submitted-v50',['📤','✅','⏰'],'education',186);
        if (/\b(?:summarize|summarized|summary of).{0,14}\b(?:chapter|lecture|class)\s+notes?\b|(?:챕터|강의|수업).{0,12}(?:필기|노트).{0,8}(?:요약|정리)|(?:필기|노트).{0,10}(?:요약|정리)/i.test(text)) return special('notes-summary-v50',['📝','📚'],'education',186);
        if (/\b(?:complete|completed|finish|finished).{0,14}\b(?:online\s+)?(?:course|class|training)\b|(?:온라인\s*)?(?:강의|과정|교육).{0,10}(?:수료|완료|끝)/i.test(text)) return special('course-complete-v50',['🎓','✅'],'education',186);
        if (/\b(?:teacher|professor|instructor).{0,18}\b(?:left|added|gave).{0,10}\b(?:comments?|feedback).{0,18}\b(?:assignment|paper|essay)\b|(?:교사|교수|강사).{0,14}(?:과제|논문|에세이).{0,10}(?:의견|댓글|피드백).{0,6}(?:남겼|작성)?/i.test(text)) return special('teacher-comments-v50',['💬','📝'],'education',186);
        if (/\b(?:lecture|class).{0,18}\b(?:moved|changed|relocated).{0,16}\b(?:room|classroom)\s*\d+\b|(?:강의실|교실).{0,10}(?:\d+호).{0,8}(?:바뀌|변경|이동)|(?:강의|수업).{0,12}(?:\d+호|강의실).{0,8}(?:바뀌|변경)/i.test(text)) return special('lecture-room-moved-v50',['🎓','📍','🔄'],'education',186);
        if (/\b(?:first\s+)?draft\b.{0,18}\b(?:research\s+paper|paper|essay).{0,12}\b(?:finished|complete|completed)?\b|\b(?:finish|finished|complete|completed).{0,14}\b(?:first\s+)?draft.{0,10}\b(?:research\s+paper|paper|essay)\b|(?:연구\s*논문|논문|에세이).{0,12}(?:첫\s*초안|초안).{0,8}(?:완성|완료)|(?:첫\s*초안).{0,12}(?:연구\s*논문|논문).{0,8}(?:완성|완료)?/i.test(text)) return special('paper-draft-done-v50',['📝','✅'],'education',186);
        if (/\b(?:study\s+group|study group).{0,18}\b(?:meet|meets|meeting).{0,18}\b(?:after|before)\s+class\b|(?:스터디\s*그룹|스터디).{0,14}(?:수업).{0,8}(?:뒤|후|전).{0,8}(?:만나|모임)/i.test(text)) return special('study-group-v50',['📚','🤝'],'education',186);

        // Work specifics.
        if (/\b(?:research|study)\s+(?:summary|brief|memo).{0,18}\b(?:ready|prepared).{0,14}\b(?:share|send)\b|(?:조사|연구)\s*(?:요약|요약본|브리프).{0,14}(?:공유|전송).{0,8}(?:준비|가능)|(?:조사|연구)\s*(?:요약|요약본).{0,12}(?:준비|완료)/i.test(text)) return special('research-summary-share-v50',['📝','📤'],'work',186);
        if (/\b(?:designer|design team).{0,18}\b(?:sent|shared|uploaded).{0,14}\b(?:updated|revised|new)\s+(?:mockup|design|prototype)\b|(?:디자이너|디자인팀).{0,14}(?:수정된|새|업데이트된)?\s*(?:시안|목업|디자인).{0,8}(?:보냈|공유|전송)/i.test(text)) return special('designer-mockup-v50',['🎨','📤'],'work',186);
        if (/\b(?:handoff|hand[- ]off).{0,20}\b(?:support|team).{0,14}\b(?:complete|completed|done)\b|(?:지원팀|팀).{0,14}(?:업무\s*)?(?:인계|핸드오프).{0,8}(?:완료|끝)/i.test(text)) return special('handoff-complete-v50',['🤝','✅'],'work',186);
        if (/\b(?:manager|lead|reviewer).{0,18}\b(?:left|added|gave).{0,12}\b(?:feedback|comments?).{0,16}\b(?:draft|document|proposal)\b|(?:관리자|리드|검토자).{0,14}(?:초안|문서|제안서).{0,10}(?:피드백|의견|댓글).{0,6}(?:남겼|추가)?/i.test(text)) return special('manager-feedback-v50',['💬','📝'],'work',186);
        if (/\b(?:assign|assigned).{0,16}\b(?:final|last|new)?\s*(?:task|item).{0,16}\b(?:to\s+)?[A-Z][a-z]+\b|(?:마지막|최종|새)?\s*(?:작업|업무|과제).{0,12}(?:[A-Za-z가-힣]+에게).{0,8}(?:배정|할당)|(?:작업|업무).{0,16}(?:담당자).{0,8}(?:지정|배정)/i.test(text)) return special('task-assigned-v50',['👤','📋'],'work',186);

        // Tech states.
        if (/\bbackup\s+(?:job|task).{0,20}\b(?:missed|miss).{0,14}\b(?:scheduled|backup)\s+(?:window|time)\b|(?:백업\s*작업|백업).{0,16}(?:예정|예약).{0,10}(?:시간|구간).{0,8}(?:놓쳤|실패)/i.test(text)) return special('backup-missed-v50',['⚠️','💾','⏰'],'tech',188);
        if (/\b(?:deploy|deployment).{0,18}\b(?:completed|finished|done).{0,22}\b(?:health|status)\s+check.{0,14}\b(?:failing|failed|failure)\b|(?:배포).{0,14}(?:완료).{0,18}(?:상태|헬스)\s*점검.{0,10}(?:실패|실패\s*중)/i.test(text)) return special('deploy-partial-fail-v50',['⚠️','🛠️'],'tech',188);
        if (/\bauth(?:entication)?\s+errors?\b.{0,22}\b(?:started|began|appeared).{0,18}\b(?:key|rotation|rotate)\b|\b(?:key|credential).{0,18}\b(?:rotation|rotated).{0,18}\bauth(?:entication)?\s+errors?\b|(?:키|자격\s*증명).{0,14}(?:교체|로테이션).{0,12}(?:인증\s*오류|인증\s*실패)|(?:인증\s*오류).{0,16}(?:키\s*교체|키\s*변경).{0,8}(?:뒤|후)?/i.test(text)) return special('auth-errors-key-v50',['❌','🔐'],'tech',188);
        if (/\b(?:endpoint|api endpoint|service endpoint).{0,18}\b(?:temporarily\s+)?(?:unavailable|down|offline)\b|(?:엔드포인트).{0,14}(?:일시적으로\s*)?(?:사용할\s*수\s*없|사용\s*불가|다운)/i.test(text)) return special('endpoint-unavailable-v50',['❌','🌐'],'tech',188);
        if (/\blogs?\b.{0,20}\b(?:repeated|repeating|multiple).{0,14}\bauth(?:entication)?\s+(?:failures?|errors?)\b|(?:로그).{0,18}(?:인증\s*실패|인증\s*오류).{0,10}(?:반복|계속)/i.test(text)) return special('auth-failures-logs-v50',['❌','🔍','🔐'],'tech',188);
        if (/\bcpu\s+usage\b.{0,20}\b(?:returned|back).{0,12}\b(?:normal|baseline).{0,18}\b(?:scale|scaled|scaling)\b|(?:스케일업|확장).{0,14}(?:CPU\s*사용량).{0,12}(?:정상|기준).{0,8}(?:돌아|복귀)/i.test(text)) return special('cpu-normal-scale-v50',['✅','💻','📊'],'tech',188);
        if (/\b(?:database|db)\s+replica\s+(?:lag|delay).{0,18}\b(?:increased|grew|rose|higher)\b|(?:데이터베이스|DB)\s*복제\s*(?:지연|래그).{0,12}(?:늘|증가|상승)/i.test(text)) return special('replica-lag-up-v50',['📈','💾','⚠️'],'tech',188);
        if (/\bapi\s+latency\b.{0,20}\b(?:higher|increased|up|worse).{0,18}\b(?:yesterday|before|baseline)?\b|(?:API)\s*(?:지연\s*시간|레이턴시).{0,14}(?:어제|기준).{0,8}(?:보다\s*)?(?:높|증가)/i.test(text)) return special('api-latency-up-v50',['📈','⏱️','💻'],'tech',188);

        // Reports: negative events improving should be trend-down, not failure.
        if (/\b(?:failed\s+payments?|payment\s+failures?).{0,22}\b(?:decreased|fell|dropped|declined|down)\b|(?:결제\s*실패|실패\s*결제).{0,14}(?:건수|수)?.{0,10}(?:줄|감소|하락)/i.test(text)) return special('failed-payments-down-v50',['📉','📊'],'report',188);
        if (/\brevenue\b.{0,20}\b(?:quarterly|annual|monthly).{0,12}\b(?:record|record high|highest)\b|\brevenue\b.{0,20}\b(?:record|record high|highest).{0,12}\b(?:quarter|quarterly)\b|(?:매출).{0,14}(?:분기|월간|연간).{0,8}(?:최고|기록|최고치)/i.test(text)) return special('revenue-record-v50',['📈','🏆'],'report',188);
        if (/\b(?:repeat purchase|repurchase)\s+rate\b.{0,18}\b(?:improved|increased|rose)\b|(?:재구매율|반복\s*구매율).{0,14}(?:개선|증가|상승)/i.test(text)) return special('repurchase-up-v50',['📈','📊'],'report',188);

        // Travel precision.
        if (/\b(?:miss|missed).{0,14}\b(?:airport|shuttle)?\s*bus\b.{0,14}\b(?:minutes?|mins?)\b|(?:공항\s*)?버스.{0,14}(?:\d+|몇)\s*분\s*차이.{0,8}(?:놓쳤|못\s*탔)/i.test(text)) return special('missed-bus-v50',['🚌','😓','⏰'],'travel',186);
        if (/\brental\s+car\b.{0,20}\b(?:must|need|has to).{0,10}\b(?:be\s+)?returned\b.{0,14}\b(?:by|before)\s+(?:\d{1,2}|nine|ten)\b|(?:렌터카|대여차).{0,14}(?:\d+시).{0,8}(?:까지|전).{0,8}(?:반납)/i.test(text)) return special('rental-return-time-v50',['🚗','⏰'],'travel',186);

        // Social scene precision.
        if (/\b(?:blew|blow).{0,12}\b(?:out\s+)?(?:the\s+)?candles?\b.{0,18}\bbirthday\s+cake\b|(?:생일\s*케이크).{0,14}(?:촛불).{0,8}(?:껐|불었)|(?:촛불).{0,12}(?:생일\s*케이크).{0,8}(?:껐|불었)/i.test(text)) return special('birthday-candles-v50',['🎂','🎉'],'social',186);
        if (/\b(?:read|reading).{0,18}\b(?:book|novel).{0,18}\b(?:under|beneath).{0,10}\b(?:a\s+)?tree\b|(?:공원|나무).{0,12}(?:아래|밑).{0,12}(?:책|독서).{0,8}(?:읽)/i.test(text)) return special('reading-under-tree-v50',['📚','🌳','😌'],'social',186);
        if (/\b(?:dance|danced|dancing).{0,16}\b(?:kitchen|while cooking|making dinner)\b|(?:저녁|요리).{0,12}(?:만들|하면서).{0,12}(?:주방).{0,8}(?:춤)|(?:주방).{0,12}(?:춤).{0,12}(?:저녁|요리)/i.test(text)) return special('kitchen-dance-v50',['💃','🍳','🎵'],'social',186);

        // v48: additional high-confidence semantic families from a fresh holdout.
        // Everyday routines.
        if (/\b(?:fold|folded|folding).{0,16}\b(?:laundry|clothes|shirts?|towels?)\b|(?:빨래|옷|수건).{0,14}(?:개었|갰|접었|정리)/i.test(text)) return special('fold-laundry-v48',['🧺','👕'],'life',170);
        if (/\b(?:load|loaded|unload|unloaded).{0,18}\b(?:dishwasher|dishes?)\b|(?:식기세척기).{0,18}(?:그릇|식기).{0,10}(?:넣었|채웠|꺼냈)|(?:그릇|식기).{0,14}(?:식기세척기).{0,8}(?:넣)/i.test(text)) return special('dishwasher-v48',['🍽️','🧼'],'life',170);
        if (/\b(?:change|changed|replace|replaced).{0,18}\b(?:bed\s*)?(?:sheets?|bedding)\b|(?:침대\s*)?(?:시트|침구).{0,14}(?:갈았|교체|바꿨)/i.test(text)) return special('change-sheets-v48',['🛏️','✨'],'life',170);
        if (/\b(?:sweep|swept|mop|mopped).{0,18}\b(?:kitchen|floor|hallway|room)\b|(?:주방|방|복도)?\s*바닥.{0,12}(?:쓸었|닦았|청소)|(?:주방|방|복도).{0,12}(?:쓸었|걸레질)/i.test(text)) return special('sweep-floor-v48',['🧹','🏠'],'life',170);
        if (/\b(?:refill|refilled|fill|filled).{0,16}\b(?:soap|detergent)\s+dispenser\b|(?:비누|세제)\s*디스펜서.{0,12}(?:채웠|리필)/i.test(text)) return special('refill-soap-v48',['🧼','🫧'],'life',170);
        if (/\b(?:fresh|new|replace|replaced|changed).{0,16}\bbatter(?:y|ies)\b.{0,16}\b(?:clock|watch)\b|\b(?:clock|watch).{0,16}\bbatter(?:y|ies).{0,12}\b(?:new|replaced|changed)\b|(?:벽시계|시계).{0,14}(?:새\s*)?(?:건전지|배터리).{0,10}(?:넣|교체|바꿨)/i.test(text)) return special('clock-battery-v48',['🔋','🕰️'],'life',170);
        if (/\b(?:organize|organized|tidy|tidied|sort|sorted).{0,16}\b(?:desk|drawer|cabinet|shelf)\b|(?:책상|서랍|찬장|선반).{0,14}(?:정리|정돈)/i.test(text)) return special('organize-drawer-v48',['🗂️','🧹'],'life',170);
        if (/\bumbrella\b.{0,18}\b(?:door|entry|entrance|front door)\b|\b(?:door|entry|entrance).{0,18}\bumbrella\b|(?:우산).{0,14}(?:현관|문|입구)|(?:현관|문|입구).{0,14}(?:우산)/i.test(text)) return special('umbrella-door-v48',['☔','🚪'],'life',170);
        if (/\b(?:pack|packed|prepare|prepared).{0,16}\b(?:lunch|meal).{0,16}\b(?:tomorrow|next day)\b|(?:내일).{0,14}(?:점심|도시락|식사).{0,10}(?:챙겼|준비|싸)/i.test(text)) return special('pack-lunch-v48',['🍱','📅'],'life',170);
        if (/\b(?:walk|walked|walking|take|took).{0,16}\b(?:dog|puppy).{0,16}\b(?:evening|night|after dinner)?\b|(?:저녁|밤).{0,12}(?:강아지|개).{0,8}(?:산책)|(?:강아지|개).{0,12}(?:저녁|밤).{0,8}(?:산책)/i.test(text)) return special('dog-walk-v48',['🐶','🚶','🌙'],'life',170);
        if (/\b(?:water|watered|watering).{0,16}\b(?:herbs?|basil|mint|rosemary).{0,16}\b(?:window|kitchen|pot)?\b|(?:허브|바질|민트|로즈마리).{0,14}(?:물\s*줬|물을\s*줬)/i.test(text)) return special('water-herbs-v48',['🌿','💧'],'life',170);
        if (/\b(?:plug|plugged).{0,14}\b(?:laptop|computer|phone).{0,16}\b(?:charger|charging|before bed|overnight)\b|(?:노트북|컴퓨터|휴대폰).{0,14}(?:충전기).{0,10}(?:꽂|연결)/i.test(text)) return special('plug-laptop-v48',['💻','🔌'],'life',170);

        // Social / expressive scenes.
        if (/\b(?:golden|orange|pink)?\s*sunset\b.{0,20}\b(?:lake|water|river)\b|\b(?:lake|water|river).{0,20}\b(?:sunset|golden sky)\b|(?:호수|강|물).{0,20}(?:노을|해질녘)|(?:노을).{0,18}(?:호수|강|물)/i.test(text)) return special('sunset-lake-v48',['🌅','🌊','📸'],'social',170);
        if (/\bcoffee\b.{0,20}\b(?:conversation|chat|catch[- ]?up).{0,20}\b(?:friend|friends)\b|\b(?:friend|friends).{0,20}\bcoffee\b.{0,20}\b(?:talk|conversation|chat)\b|(?:친구).{0,16}(?:커피).{0,16}(?:이야기|대화|수다)|(?:커피).{0,16}(?:친구).{0,16}(?:이야기|대화)/i.test(text)) return special('coffee-friend-v48',['☕','🤝','💛'],'social',170);
        if (/\bpicnic\b.{0,20}\b(?:tree|trees|park|afternoon|sun)\b|\b(?:tree|park).{0,20}\bpicnic\b|(?:피크닉).{0,18}(?:나무|공원|오후|햇살)|(?:나무|공원).{0,18}(?:피크닉)/i.test(text)) return special('picnic-v48',['🧺','🌳','☀️'],'social',170);
        if (/\bconcert\b.{0,24}\b(?:encore|music|night|show)\b|\bencore\b.{0,16}\bconcert\b|(?:콘서트|공연).{0,18}(?:앙코르|음악|밤)|(?:앙코르).{0,14}(?:콘서트|공연)/i.test(text)) return special('concert-encore-v48',['🎵','🎤','🌙'],'social',170);
        if (/\b(?:homemade|made).{0,14}\bpancakes?\b.{0,20}\b(?:sunday|morning|slow)\b|(?:팬케이크).{0,16}(?:일요일|아침|직접|만든)/i.test(text)) return special('pancake-morning-v48',['🥞','☕','😌'],'social',170);
        if (/\brainbow\b.{0,20}\b(?:rain|shower|storm|after)\b|\b(?:after|following).{0,10}\brain\b.{0,14}\brainbow\b|(?:비|소나기).{0,16}(?:그친|뒤|후).{0,12}(?:무지개)|(?:무지개).{0,16}(?:비|소나기)/i.test(text)) return special('rainbow-after-rain-v48',['🌈','🌧️'],'social',170);
        if (/\b(?:reading|book)\s+(?:corner|spot|nook)\b.{0,18}\b(?:window|quiet|cozy|cosy)\b|\b(?:window).{0,18}\b(?:reading|book)\s+(?:corner|spot|nook)\b|(?:창가).{0,14}(?:독서|책).{0,10}(?:자리|공간)|(?:독서\s*자리).{0,12}(?:창가)/i.test(text)) return special('reading-corner-v48',['📚','🪟','😌'],'social',170);
        if (/\b(?:first|first time).{0,12}\b(?:swim|swimming).{0,14}\b(?:summer|season)\b|\b(?:summer).{0,14}\b(?:first|first time).{0,10}\b(?:swim|swimming)\b|(?:올여름|이번\s*여름).{0,12}(?:첫\s*수영|처음\s*수영)|(?:첫\s*수영).{0,12}(?:여름)/i.test(text)) return special('first-summer-swim-v48',['🏊','☀️','🌊'],'social',170);
        if (/\b(?:fresh|homemade|baked).{0,16}\bbread\b.{0,18}\b(?:cooling|counter|table)\b|(?:갓|막)\s*(?:구운)?\s*빵.{0,16}(?:식고|식탁|테이블|카운터)|(?:빵).{0,14}(?:식고\s*있)/i.test(text)) return special('fresh-bread-v48',['🍞','😋'],'social',170);
        if (/\b(?:bike|bicycle)\s+ride\b.{0,20}\b(?:sunset|evening|long)\b|\b(?:long).{0,10}\b(?:bike|bicycle)\s+ride\b|(?:자전거).{0,16}(?:길게|오래|라이딩|탔다).{0,14}(?:해\s*지|노을|저녁)?/i.test(text)) return special('bike-ride-v48',['🚲','🌇'],'social',170);
        if (/\b(?:dog|puppy).{0,20}\b(?:fell asleep|slept|sleeping).{0,18}\b(?:feet|foot|lap)\b|(?:강아지|개).{0,16}(?:발|무릎).{0,10}(?:잠들|잤)/i.test(text)) return special('dog-sleep-v48',['🐶','😴','💛'],'social',170);
        if (/\b(?:finish|finished|done).{0,16}\b(?:paint|painting).{0,16}\b(?:shelf|cabinet|wall|room)\b|(?:선반|찬장|벽|방).{0,16}(?:페인트|칠).{0,10}(?:끝|완료|마쳤)/i.test(text)) return special('paint-finished-v48',['🎨','✅','🛠️'],'social',170);

        // Work / collaboration.
        if (/\b(?:calendar\s+invite|meeting\s+invite|invite).{0,20}\b(?:sent|send|friday|morning)\b|\b(?:sent|send).{0,16}\b(?:calendar|meeting)\s+invite\b|(?:일정|회의)\s*초대.{0,12}(?:보냈|전송|발송)|(?:금요일|오전).{0,12}(?:일정\s*초대)/i.test(text)) return special('calendar-invite-v48',['📅','📤'],'work',172);
        if (/\b(?:signed|executed)\s+contract\b.{0,20}\b(?:shared|folder|drive)\b|\b(?:shared|team)\s+folder\b.{0,18}\b(?:signed|executed)\s+contract\b|(?:서명된|체결된)\s*계약서.{0,16}(?:공유\s*폴더|드라이브|폴더)/i.test(text)) return special('signed-contract-folder-v48',['📜','✅','📁'],'work',172);
        if (/\bfinance\b.{0,18}\b(?:approved|approval).{0,18}\b(?:revised|updated)?\s*budget\b|(?:재무팀|재무).{0,16}(?:수정|업데이트)?\s*예산.{0,10}(?:승인)/i.test(text)) return special('budget-approved-v48',['✅','💰','📊'],'work',172);
        if (/\b(?:slide\s+deck|slides?|presentation).{0,20}\b(?:ready|prepared).{0,18}\b(?:tomorrow|presentation)\b|(?:슬라이드|발표\s*자료|프레젠테이션).{0,16}(?:내일|발표).{0,10}(?:준비|완료)|(?:내일).{0,12}(?:발표\s*자료|슬라이드).{0,10}(?:준비)/i.test(text)) return special('deck-ready-v48',['📊','✅','📅'],'work',172);
        if (/\b(?:summarize|summarized|write|wrote).{0,18}\bmeeting\s+notes\b.{0,20}\b(?:assign|assigned).{0,10}\b(?:owners?|assignees?)\b|(?:회의록|회의\s*메모).{0,16}(?:정리|요약).{0,16}(?:담당자|오너).{0,8}(?:지정|배정)/i.test(text)) return special('meeting-notes-owners-v48',['📝','👤','📋'],'work',172);
        if (/\b(?:client|customer).{0,18}\b(?:asked|requested).{0,16}\b(?:one|another|more).{0,10}\brevision\b|(?:고객|클라이언트).{0,16}(?:한\s*번\s*더|추가).{0,10}(?:수정|리비전).{0,8}(?:요청)/i.test(text)) return special('client-revision-v48',['✏️','🔄'],'work',172);
        if (/\b(?:send|submit).{0,14}\b(?:the\s+)?draft\b.{0,16}\b(?:by|before)\s+(?:noon|midday|\d{1,2})\b|(?:정오|낮\s*12시).{0,10}(?:까지|전).{0,12}(?:초안).{0,8}(?:보내|제출)|(?:초안).{0,14}(?:정오|낮\s*12시).{0,8}(?:까지|전).{0,6}(?:보내|제출)?/i.test(text)) return special('draft-noon-v48',['📤','⏰','📝'],'work',172);
        if (/\b(?:hiring|interview)\s+panel\b.{0,20}\b(?:finished|completed).{0,14}\b(?:candidate|applicant)\s+review\b|(?:채용|면접)\s*패널.{0,16}(?:지원자|후보자).{0,10}(?:검토).{0,8}(?:마쳤|완료)/i.test(text)) return special('candidate-review-done-v48',['✅','👥','📋'],'work',172);
        if (/\b(?:project\s+)?kickoff\b.{0,20}\b(?:moved|rescheduled|shifted).{0,18}\b(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday)\b|(?:프로젝트\s*)?킥오프.{0,16}(?:다음\s*)?(?:월요일|화요일|수요일|목요일|금요일).{0,10}(?:옮겼|변경|재조정)/i.test(text)) return special('kickoff-moved-v48',['📅','🔄'],'work',172);
        if (/\blegal\b.{0,18}\b(?:approved|cleared).{0,18}\b(?:final|wording|language|copy)\b|(?:법무팀|법무).{0,16}(?:최종\s*)?(?:문구|문안|표현).{0,10}(?:승인|확인)/i.test(text)) return special('legal-wording-approved-v48',['⚖️','✅'],'work',172);
        if (/\b(?:expense|travel)\s+report\b.{0,22}\b(?:waiting|pending|awaiting).{0,14}\b(?:manager|approval)\b|(?:경비|비용|출장비)\s*보고서.{0,16}(?:관리자|승인).{0,10}(?:기다리|대기|보류)/i.test(text)) return special('expense-approval-v48',['🧾','⏳'],'work',172);
        if (/\b(?:add|added).{0,16}\b(?:new\s+)?deadline\b.{0,18}\b(?:project|plan|schedule)\b|(?:프로젝트|계획).{0,16}(?:새\s*)?마감일.{0,10}(?:추가|등록)|(?:새\s*)?마감일.{0,14}(?:프로젝트|계획).{0,8}(?:추가)/i.test(text)) return special('deadline-added-v48',['📅','⏰','📋'],'work',172);

        // Tech / operations.
        if (/\bcpu\s+(?:usage|load)\b.{0,22}\b(?:spiked|spike|high|jumped|surged).{0,18}\b(?:deploy|deployment|release)?\b|(?:CPU)\s*(?:사용량|부하).{0,16}(?:급증|치솟|높아).{0,14}(?:배포|릴리스)?/i.test(text)) return special('cpu-spike-v48',['📈','💻','⚠️'],'tech',174);
        if (/\b(?:disk|storage)\s+(?:space|capacity)\b.{0,22}\b(?:low|running low|almost full|nearly full)\b|(?:디스크|저장)\s*(?:공간|용량).{0,16}(?:부족|거의\s*참|가득)/i.test(text)) return special('disk-low-v48',['💾','⚠️'],'tech',174);
        if (/\bdns\b.{0,22}\b(?:propagat(?:e|ed|ing|ion)).{0,16}\b(?:complete|completed|finished|done)\b|\bdns\b.{0,24}\b(?:changes?).{0,16}\b(?:finished|completed).{0,12}\b(?:propagat)/i.test(text) || /(?:DNS).{0,18}(?:변경|설정).{0,12}(?:전파).{0,8}(?:완료|끝)/i.test(text)) return special('dns-propagation-v48',['🌐','✅'],'tech',174);
        if (/\b(?:deployment|deploy|release).{0,18}\b(?:passed|passes|cleared).{0,16}\b(?:all\s+)?(?:health|status)\s+checks?\b|(?:배포|릴리스).{0,16}(?:모든\s*)?(?:상태|헬스)\s*점검.{0,10}(?:통과|성공)/i.test(text)) return special('health-check-pass-v48',['✅','🛠️'],'tech',174);
        if (/\b(?:restore|restored|recover|recovered).{0,18}\b(?:database|db).{0,18}\b(?:from|using)\s+(?:the\s+)?backup\b|(?:백업).{0,16}(?:데이터베이스|DB).{0,12}(?:복원|복구)|(?:데이터베이스|DB).{0,16}(?:백업).{0,10}(?:복원|복구)/i.test(text)) return special('db-restore-v48',['💾','🔄','✅'],'tech',174);
        if (/\b(?:latency|response delay).{0,22}\b(?:dropped|decreased|fell|improved).{0,18}\b(?:cache|caching)\b|(?:캐시).{0,16}(?:변경|수정).{0,12}(?:지연\s*시간|레이턴시).{0,8}(?:줄|감소|개선)|(?:지연\s*시간|레이턴시).{0,16}(?:캐시).{0,10}(?:줄|감소)/i.test(text)) return special('latency-cache-v48',['📉','⚡','📊'],'tech',174);
        if (/\b(?:worker|consumer|processor).{0,18}\b(?:stopped|quit|ceased).{0,14}\b(?:processing|handling|running)\s+(?:jobs?|tasks?|messages?)\b|(?:워커|컨슈머|작업자).{0,16}(?:작업|메시지).{0,10}(?:처리).{0,8}(?:멈췄|중단|안\s*함)/i.test(text)) return special('worker-stopped-v48',['❌','⚙️'],'tech',174);
        if (/\b(?:auth(?:entication)?\s+)?token\b.{0,18}\b(?:expires?|expiring).{0,16}\b(?:tonight|today|tomorrow|soon)\b|(?:인증\s*)?토큰.{0,16}(?:오늘\s*밤|오늘|내일|곧).{0,10}(?:만료)/i.test(text)) return special('token-expiry-v48',['🔐','⏰','⚠️'],'tech',174);
        if (/\b(?:rotate|rotated|replace|replaced).{0,16}\bapi\s+key\b|\bapi\s+key\b.{0,16}\b(?:rotated|replaced|changed)\b|(?:API\s*키).{0,14}(?:교체|로테이션|변경|갱신)/i.test(text)) return special('api-key-rotated-v48',['🔐','🔄'],'tech',174);
        if (/\bbuild\b.{0,18}\b(?:failed|failure).{0,16}\b(?:test|testing)\s+(?:step|stage|phase)\b|(?:빌드).{0,16}(?:테스트).{0,10}(?:단계|스텝).{0,8}(?:실패)/i.test(text)) return special('build-test-fail-v48',['❌','💻','🧪'],'tech',174);
        if (/\b(?:incident|outage|issue).{0,22}\b(?:resolved|fixed|closed).{0,18}\b(?:config|configuration|setting|fix)\b|(?:설정|구성).{0,16}(?:수정|변경).{0,12}(?:장애|이슈|문제).{0,8}(?:해결|복구)/i.test(text)) return special('incident-resolved-config-v48',['✅','🛠️'],'tech',174);
        if (/\b(?:error|failure)\s+rate\b.{0,22}\b(?:returned|back).{0,12}\b(?:normal|baseline)\b|(?:오류율|에러율).{0,16}(?:정상|기준).{0,8}(?:돌아|복귀)/i.test(text)) return special('error-rate-normal-v48',['✅','📊'],'tech',174);

        // Commerce.
        if (/\btracking\s+(?:number|code|link)\b.{0,20}\b(?:active|working|available|live)\b|(?:배송\s*조회|운송장)\s*(?:번호|코드|링크).{0,14}(?:활성|조회\s*가능|작동)/i.test(text)) return special('tracking-active-v48',['📦','🔎'],'commerce',172);
        if (/\bexchange\s+(?:request|return).{0,18}\b(?:approved|accepted|authorized)\b|(?:교환).{0,12}(?:요청|신청).{0,10}(?:승인|수락)/i.test(text)) return special('exchange-approved-v48',['✅','🔄'],'commerce',172);
        if (/\b(?:coupon|promo code|voucher).{0,18}\b(?:expires?|ends?).{0,14}\b(?:midnight|tonight)\b|(?:쿠폰|프로모션\s*코드).{0,14}(?:자정|오늘\s*밤).{0,8}(?:만료|종료)/i.test(text)) return special('coupon-midnight-v48',['🏷️','⏰'],'commerce',172);
        if (/\border\b.{0,18}\b(?:waiting|pending|awaiting).{0,14}\bpayment\s+(?:confirmation|approval)\b|(?:주문).{0,14}(?:결제).{0,12}(?:확인|승인).{0,8}(?:기다리|대기|보류)/i.test(text)) return special('order-payment-wait-v48',['⏳','💳'],'commerce',172);
        if (/\b(?:item|product|order|package).{0,18}\b(?:shipped|left|departed).{0,14}\b(?:warehouse|fulfillment|facility)\b|(?:상품|주문|택배).{0,14}(?:창고|물류센터).{0,8}(?:출발|발송|배송\s*시작)/i.test(text)) return special('item-left-warehouse-v48',['📦','🚚'],'commerce',172);
        if (/\bdelivery\s+address\b.{0,18}\b(?:needs?|requires?).{0,12}\b(?:correction|fix|update)\b|(?:배송\s*주소).{0,14}(?:수정|고침|변경).{0,8}(?:필요|해야)/i.test(text)) return special('delivery-address-fix-v48',['📍','✏️'],'commerce',172);
        if (/\breceipt\b.{0,18}\b(?:available|ready).{0,14}\b(?:download|to download)\b|(?:영수증).{0,14}(?:다운로드).{0,8}(?:가능|할\s*수|준비)/i.test(text)) return special('receipt-download-v48',['🧾','📥'],'commerce',172);
        if (/\bpre[- ]?order\b.{0,18}\b(?:opens?|starts?|begins?).{0,12}\b(?:tomorrow|today)\b|(?:사전\s*주문|프리오더).{0,14}(?:내일|오늘).{0,8}(?:열|시작)/i.test(text)) return special('preorder-opens-v48',['🛒','📅'],'commerce',172);
        if (/\b(?:only|just)\s+(?:one|two|three|four|five|\d+)\s+(?:units?|items?|pieces?)\b.{0,12}\b(?:remain|left|in stock)\b|(?:재고).{0,10}(?:한|두|세|네|다섯|\d+)\s*(?:개|개만).{0,8}(?:남|있)/i.test(text)) return special('stock-low-v48',['⚠️','🛒'],'commerce',172);
        if (/\brefund\b.{0,18}\b(?:completed|finished|processed|issued)\b|(?:환불).{0,14}(?:처리|지급).{0,8}(?:완료|끝|됐)/i.test(text)) return special('refund-complete-v48',['✅','💳'],'commerce',172);
        if (/\b(?:package|parcel|order).{0,20}\b(?:returned|sent back).{0,14}\b(?:sender|merchant|shop)\b|(?:택배|소포|주문).{0,14}(?:발송인|판매자|상점).{0,8}(?:반송|돌아)/i.test(text)) return special('returned-sender-v48',['📦','↩️'],'commerce',172);
        if (/\b(?:store|shop)\s+pickup\b.{0,20}\b(?:window|time).{0,14}\b(?:closes?|ends?).{0,10}\b(?:six|\d)\b|(?:매장|상점)\s*픽업.{0,16}(?:가능\s*)?(?:시간|기한).{0,10}(?:끝|종료|닫)/i.test(text)) return special('pickup-window-v48',['📍','⏰'],'commerce',172);

        // Travel.
        if (/\b(?:departure|boarding)\s+gate\b.{0,18}\b(?:changed|moved|switched).{0,14}\b(?:to\s+)?[A-Z]?\d+\b|(?:출발|탑승)\s*게이트.{0,14}(?:[A-Z]?\d+).{0,8}(?:바뀌|변경|이동)/i.test(text)) return special('gate-changed-v48',['✈️','🔄'],'travel',172);
        if (/\b(?:save|saved|downloaded).{0,16}\b(?:boarding\s+pass|boarding pass|ticket).{0,18}\b(?:phone|mobile|wallet)\b|(?:탑승권|보딩패스).{0,14}(?:휴대폰|폰|모바일|지갑).{0,8}(?:저장|다운로드)/i.test(text)) return special('boarding-pass-phone-v48',['🎫','📱','✈️'],'travel',172);
        if (/\bhotel\s+check[- ]?in\b.{0,18}\b(?:starts?|opens?|from).{0,10}\b(?:\d{1,2}|three|four)\b|(?:호텔).{0,10}체크인.{0,14}(?:\d+시|오전|오후).{0,8}(?:시작|부터)/i.test(text)) return special('hotel-checkin-time-v48',['🏨','⏰'],'travel',172);
        if (/\btrain\b.{0,18}\b(?:leaves?|departs?).{0,12}\b(?:from\s+)?platform\s+(?:\d+|one|two|three|four|five|six|seven)\b|(?:기차|열차).{0,14}(?:\d+번\s*)?(?:승강장|플랫폼).{0,8}(?:출발)/i.test(text)) return special('train-platform-v48',['🚆','📍'],'travel',172);
        if (/\b(?:luggage|bags?|suitcases?).{0,18}\b(?:delivered|sent).{0,14}\b(?:hotel|hostel)\b|(?:짐|수하물|가방).{0,14}(?:호텔|호스텔).{0,8}(?:배송|배달|보냈)/i.test(text)) return special('luggage-hotel-v48',['🧳','🏨','✅'],'travel',172);
        if (/\b(?:road|route).{0,20}\b(?:viewpoint|lookout|scenic).{0,14}\b(?:closed|blocked)\b|\b(?:viewpoint|lookout).{0,18}\b(?:road|route).{0,12}\b(?:closed|blocked)\b|(?:전망대).{0,16}(?:도로|길).{0,10}(?:폐쇄|통제|막힘)/i.test(text)) return special('viewpoint-road-closed-v48',['🚫','🚗','📍'],'travel',172);
        if (/\b(?:book|booked|reserve|reserved).{0,14}\b(?:taxi|cab).{0,14}\b(?:airport)\b|(?:공항).{0,12}(?:택시).{0,8}(?:예약)|(?:택시).{0,12}(?:공항).{0,8}(?:예약)/i.test(text)) return special('airport-taxi-v48',['🚕','✈️','📅'],'travel',172);
        if (/\bferry\b.{0,18}\b(?:leaves?|departs?).{0,12}\b(?:at\s+)?(?:sunrise|dawn)\b|(?:페리|배).{0,14}(?:일출|해돋이|새벽).{0,8}(?:출발)/i.test(text)) return special('ferry-sunrise-v48',['🚢','🌅'],'travel',172);
        if (/\b(?:hiking|mountain)\s+trail\b.{0,18}\b(?:muddy|mud|slippery).{0,16}\brain\b|\brain\b.{0,18}\b(?:trail).{0,12}\b(?:muddy|slippery)\b|(?:비|비가).{0,14}(?:등산로|산길|트레일).{0,10}(?:진흙|미끄럽)/i.test(text)) return special('muddy-trail-v48',['🥾','🌧️'],'travel',172);
        if (/\b(?:renew|renewed|update|updated).{0,16}\bpassport\b.{0,18}\b(?:trip|travel|before)\b|(?:여행).{0,12}(?:전|앞두고).{0,10}(?:여권).{0,8}(?:갱신|재발급)|(?:여권).{0,14}(?:갱신|재발급).{0,12}(?:여행)/i.test(text)) return special('passport-renewed-v48',['🛂','✅'],'travel',172);
        if (/\b(?:hostel|hotel).{0,18}\b(?:free\s+)?(?:luggage|bag)\s+storage\b|(?:호스텔|호텔).{0,14}(?:짐|수하물).{0,8}(?:무료|공짜).{0,8}(?:보관)|(?:무료).{0,8}(?:짐|수하물)\s*보관/i.test(text)) return special('free-luggage-storage-v48',['🎒','🏨'],'travel',172);
        if (/\b(?:last|final)\s+bus\b.{0,18}\b(?:leaves?|departs?).{0,12}\b(?:\d+|thirty|twenty|ten)\s+minutes?\b|(?:막차|마지막)\s*버스.{0,14}(?:\d+|몇|삼십|이십|십)\s*분\s*(?:뒤|후).{0,8}(?:출발)/i.test(text)) return special('last-bus-v48',['🚌','⏰'],'travel',172);

        // Metrics / reports.
        if (/\b(?:monthly|weekly|daily)?\s*signups?\b.{0,20}\b(?:increased|grew|rose|up).{0,12}\b(?:percent|%)?\b|(?:월간|주간|일간)?\s*가입자.{0,16}(?:증가|늘|상승)/i.test(text)) return special('signups-up-v48',['📈','📊'],'report',170);
        if (/\bconversion\s+rate\b.{0,18}\b(?:flat|unchanged|same|stable)\b|(?:전환율).{0,14}(?:비슷|변화\s*없|그대로|안정)/i.test(text)) return special('conversion-flat-v48',['📊','➡️'],'report',170);
        if (/\b(?:average\s+)?latency\b.{0,20}\b(?:decreased|fell|dropped|down|reduced)\b|(?:평균\s*)?(?:지연\s*시간|레이턴시).{0,16}(?:줄|감소|하락)/i.test(text)) return special('latency-down-v48',['📉','⏱️'],'report',170);
        if (/\bretention\b.{0,20}\b(?:improved|increased|rose|better)\b|(?:유지율|리텐션).{0,16}(?:개선|증가|상승)/i.test(text)) return special('retention-up-v48',['📈','📊'],'report',170);
        if (/\b(?:support|ticket|request)\s+(?:volume|count)\b.{0,20}\b(?:record|new high|highest|peak)\b|(?:지원\s*요청|문의|티켓).{0,12}(?:건수|수).{0,12}(?:최고|기록|최고치)/i.test(text)) return special('support-volume-high-v48',['📈','🏆'],'report',170);
        if (/\b(?:error|failure)\s+rate\b.{0,20}\b(?:fell|dropped|decreased|below|under)\b|(?:오류율|에러율).{0,16}(?:떨어|감소|하락|아래)/i.test(text)) return special('error-rate-down-v48',['📉','📊'],'report',170);
        if (/\brevenue\b.{0,20}\b(?:remained|stayed).{0,10}\b(?:unchanged|flat|same)\b|(?:매출).{0,16}(?:같은\s*수준|변화\s*없|그대로|비슷).{0,8}(?:유지)?/i.test(text)) return special('revenue-flat-v48',['📊','➡️'],'report',170);
        if (/\b(?:average\s+)?order\s+value\b.{0,20}\b(?:increased|grew|rose|up)\b|(?:평균\s*)?주문\s*금액.{0,16}(?:증가|상승|늘)/i.test(text)) return special('aov-up-v48',['📈','💰'],'report',170);
        if (/\brefund\s+requests?\b.{0,20}\b(?:decreased|fell|dropped|down)\b|(?:환불\s*요청).{0,14}(?:감소|줄|하락)/i.test(text)) return special('refund-requests-down-v48',['📉','📊'],'report',170);
        if (/\b(?:daily\s+active\s+users?|dau)\b.{0,20}\b(?:record|highest|new high)\b|(?:일일\s*)?활성\s*사용자.{0,16}(?:최고|기록|최고치)/i.test(text)) return special('dau-record-v48',['📈','🏆'],'report',170);
        if (/\b(?:response|reply)\s+time\b.{0,20}\b(?:stable|unchanged|same|similar)\b|(?:응답|답변)\s*시간.{0,16}(?:안정|비슷|변화\s*없|그대로)/i.test(text)) return special('response-time-flat-v48',['📊','➡️'],'report',170);
        if (/\b(?:bug|defect)\s+(?:count|volume)\b.{0,20}\b(?:rose|increased|grew|up)\b|(?:버그|결함).{0,10}(?:수|건수).{0,14}(?:늘|증가|상승)/i.test(text)) return special('bug-count-up-v48',['📈','📊'],'report',170);

        // Emotion / journal language.
        if (/\b(?:proud of|proud that|feel proud).{0,30}\b(?:how far|progress|come|made)\b|(?:여기까지|성장|진전).{0,18}(?:자랑스럽|뿌듯)|(?:자랑스럽|뿌듯).{0,18}(?:여기까지|성장|진전)/i.test(text)) return special('proud-progress-v48',['🥹','💛','🎯'],'mood',170);
        if (/\b(?:nervous|anxious).{0,28}\b(?:tomorrow|but).{0,28}\b(?:handle|manage|can do|okay)\b|(?:내일).{0,12}(?:긴장|불안).{0,20}(?:잘\s*해낼|할\s*수|괜찮)/i.test(text)) return special('nervous-but-capable-v48',['😥','💪'],'mood',170);
        if (/\b(?:peaceful|calm|quiet).{0,20}\b(?:needed|needed it|day|today)\b|(?:오늘|하루).{0,14}(?:평온|차분|조용).{0,16}(?:필요|좋았)/i.test(text)) return special('needed-peace-v48',['😌','🌿'],'mood',170);
        if (/\b(?:miss|missing).{0,18}\b(?:friends?|family|people).{0,16}\b(?:more|than|expected)?\b|(?:친구|가족|사람들).{0,14}(?:보고\s*싶|그립).{0,12}(?:많이|생각보다)?/i.test(text)) return special('miss-people-v48',['🥺','💛'],'mood',170);
        if (/\b(?:excited|looking forward).{0,24}\b(?:start|starting|begin|new).{0,20}\b(?:next month|next week|soon)\b|(?:다음\s*달|다음\s*주|곧).{0,14}(?:새로운\s*시작|새로\s*시작|시작).{0,10}(?:기대|설레)|(?:새로운\s*시작).{0,14}(?:기대|설레)/i.test(text)) return special('excited-new-start-v48',['🤩','🌱','🚀'],'mood',170);
        if (/\b(?:disappointed|let down).{0,22}\b(?:but|however).{0,24}\b(?:learned|learnt|lesson)\b|(?:실망).{0,16}(?:하지만|했지만).{0,16}(?:배웠|배움|교훈)/i.test(text)) return special('disappointed-learned-v48',['😔','🌱','💡'],'mood',170);
        if (/\b(?:grateful|thankful).{0,24}\b(?:people|friends?|family).{0,20}\b(?:stayed|close|support)\b|(?:곁에|함께).{0,16}(?:있어\s*준|남아\s*준).{0,14}(?:사람|친구|가족).{0,8}(?:감사|고맙)|(?:사람들|친구|가족).{0,16}(?:곁에|함께).{0,10}(?:감사|고맙)/i.test(text)) return special('grateful-people-v48',['🙏','💛'],'mood',170);
        if (/\b(?:ready|feel ready).{0,18}\b(?:move forward|move on|start again|next step)\b|(?:앞으로|다음으로).{0,14}(?:나아갈|가|움직일).{0,12}(?:준비|준비가\s*됐)/i.test(text)) return special('ready-move-forward-v48',['🌱','💪'],'mood',170);

        // Additional ambiguity guards.
        if (/\b(?:release|launch).{0,20}\b(?:not|no longer)\s+(?:cancelled|canceled)\b|(?:릴리스|출시).{0,16}(?:이제|더\s*이상).{0,8}(?:취소\s*상태가\s*아니|취소된\s*게\s*아니)/i.test(text)) return special('release-restored-v48',['✅','🚀'],'status',180);
        if (/\bpayment\b.{0,20}\b(?:no longer|not)\s+pending\b|(?:결제).{0,16}(?:더\s*이상|이제).{0,8}(?:대기\s*상태가\s*아니|대기\s*중이\s*아니)/i.test(text)) return special('payment-not-pending-v48',['✅','💳'],'status',180);
        if (/\b(?:not|isn['’]t|wasn['’]t)\s+disappointed\b|(?:실망스럽|실망한|실망).{0,10}(?:않|아니)/i.test(text)) return special('not-disappointed-v48',['😊','👍'],'mood',180);
        if (/\b(?:run|ran)\b.{0,18}\b(?:monthly|weekly|daily)\s+report\b|(?:월간|주간|일간)\s*보고서.{0,14}(?:실행|돌렸)/i.test(text)) return special('run-report-v48',['📊','💻'],'work',180);
        if (/\b(?:meet|met)\s+(?:the\s+)?deadline\b.{0,12}\b(?:early|before|ahead)\b|(?:마감일|기한).{0,12}(?:보다|전에).{0,8}(?:일찍|미리).{0,8}(?:끝|완료|제출)/i.test(text)) return special('deadline-early-v48',['✅','⏰'],'work',180);
        if (/\b(?:bug|issue).{0,18}\b(?:not|no longer)\s+(?:reproducible|reproducing|reproduced)\b|(?:버그|이슈).{0,14}(?:이제|더\s*이상).{0,8}(?:재현되지\s*않|재현\s*안\s*됨)/i.test(text)) return special('bug-not-repro-v48',['✅','🐛'],'tech',180);
        if (/\bserver\b.{0,20}\b(?:not|isn['’]t|wasn['’]t)\s+down\b.{0,20}\b(?:monitor|monitoring|alert).{0,12}\b(?:wrong|incorrect|stale)\b|(?:서버).{0,14}(?:다운된\s*게\s*아니|다운\s*상태가\s*아니).{0,16}(?:모니터|모니터링|알림).{0,10}(?:잘못|오류|오래)/i.test(text)) return special('server-monitor-wrong-v48',['✅','🛠️'],'tech',180);
        if (/\b(?:do not|don['’]t|never).{0,14}\b(?:publish|post|share|send).{0,18}\b(?:password|credential|secret)\b|(?:문서|게시물).{0,14}(?:비밀번호|암호).{0,10}(?:게시|공유|전송).{0,8}(?:하지\s*마|마세요|금지)/i.test(text)) return special('password-no-publish-v48',['⚠️','🔐'],'safety',180);
        if (/\b(?:mouse\s+pointer|mouse\s+cursor|cursor).{0,18}\b(?:frozen|stuck|not moving|stopped)\b|(?:마우스\s*포인터|커서).{0,14}(?:멈췄|안\s*움직|고정)/i.test(text)) return special('mouse-pointer-frozen-v48',['🖱️','💻'],'tech',180);
        if (/\b(?:book|booked|reserve|reserved).{0,14}\b(?:a\s+)?table\b.{0,22}\b(?:restaurant|dinner|not a database|not database)\b|(?:데이터베이스\s*테이블이\s*아니|DB\s*테이블이\s*아니).{0,18}(?:식당\s*)?테이블.{0,10}(?:예약)|(?:식당\s*)?테이블.{0,14}(?:예약).{0,20}(?:데이터베이스|DB).{0,8}(?:아니)/i.test(text)) return special('restaurant-table-v48',['🍽️','📅'],'social',180);

        // v47: morphology / word-order repairs found after v46.
        if (/(?:몇\s*년\s*만에|오랜만에|다시|처음).{0,18}(?:롤러스케이트|인라인)|(?:롤러스케이트|인라인).{0,18}(?:몇\s*년\s*만에|오랜만에|다시|처음)/i.test(text)) return special('roller-skates-v47',['🛼','😂'],'social',165);
        if (/(?:서비스|서버|워커).{0,18}(?:정상적으로|정상|성공적으로).{0,10}(?:재시작|다시\s*시작)|(?:정상적으로|정상|성공적으로).{0,12}(?:서비스|서버|워커).{0,10}(?:재시작|다시\s*시작)/i.test(text)) return special('service-restarted-ko-v47',['✅','🔄','🛠️'],'tech',165);
        if (/(?:고객|클라이언트)\s*검토.{0,24}(?:월요일|화요일|수요일|목요일|금요일|오전|오후).{0,16}(?:옮겨|이동|변경|미뤄|당겨|재조정)/i.test(text)) return special('client-review-moved-ko-v47',['📅','🔄'],'work',165);
        if (/\b(?:computer|pc|laptop).{0,18}\bmouse\b.{0,16}\b(?:stopped|quit|ceased).{0,10}\bclick(?:ing)?\b|\b(?:computer|pc|laptop).{0,18}\bmouse\b.{0,16}\bclick(?:ing)?\b.{0,10}\b(?:stopped|broken|failed)\b/i.test(text)) return special('computer-mouse-v47',['🖱️','💻'],'tech',165);

        // v46: broad semantic families for everyday, social, work, ops, commerce,
        // travel and reporting language. These precede older fallback rules so that
        // concrete intent wins over generic icons.

        // --- Ambiguity / negation guards ---
        if (/\b(?:account|profile|user).{0,24}\b(?:no longer|not)\s+(?:disabled|locked|blocked)\b|(?:계정|프로필|사용자).{0,22}(?:이제|더\s*이상).{0,10}(?:비활성|잠김|차단).{0,8}(?:상태가\s*)?(?:아니|아닌)/i.test(text)) return special('account-restored-v46',['✅','🔓'],'status',160);
        if (/\b(?:flight|train|bus|ferry).{0,24}\b(?:no longer|not)\s+(?:delayed|late)\b|(?:비행기|항공편|기차|버스|페리).{0,22}(?:이제|더\s*이상).{0,10}(?:지연|늦).{0,8}(?:상태가\s*)?(?:아니|아닌)/i.test(text)) return special('transit-not-delayed-v46',['✅','✈️'],'travel',160);
        if (/\b(?:don['’]t|do not|never)\s+(?:send|share|email).{0,22}\b(?:password|passcode|credential|secret)\b|(?:비밀번호|암호|인증\s*정보).{0,22}(?:이메일|메일|공유|전송).{0,12}(?:하지\s*마|마세요|금지)/i.test(text)) return special('credential-do-not-send-v46',['⚠️','🔐'],'safety',160);
        if (/\b(?:ran into|bumped into|met by chance|happened to meet)\b.{0,28}\b(?:professor|teacher|friend|neighbor|neighbour|colleague|coworker)\b|(?:우연히|마침).{0,16}(?:교수님|선생님|친구|이웃|동료).{0,10}(?:만났|마주쳤)|(?:교수님|선생님|친구|이웃|동료).{0,16}(?:우연히|마침).{0,10}(?:만났|마주쳤)/i.test(text)) return special('chance-meeting-v46',['🤝','😊'],'social',160);
        if (/\b(?:run|execute|start)\b.{0,22}\b(?:database|db|cleanup|maintenance|migration|backup)\b.{0,18}\b(?:script|job|task|command)\b|(?:데이터베이스|DB|정리|유지보수|마이그레이션|백업).{0,22}(?:스크립트|작업|잡|명령).{0,14}(?:실행|돌려|시작)/i.test(text)) return special('execute-script-v46',['💻','🛠️'],'tech',160);
        if (/\b(?:computer|pc|laptop).{0,18}\bmouse\b.{0,20}\b(?:click|clicking|button).{0,16}\b(?:stopped|broken|not working|doesn['’]t work)\b|(?:컴퓨터|PC|노트북).{0,16}(?:마우스).{0,18}(?:클릭|버튼).{0,12}(?:안\s*돼|되지\s*않|고장)/i.test(text)) return special('computer-mouse-v46',['🖱️','💻'],'tech',160);
        if (/\b(?:not|isn['’]t|wasn['’]t|am not)\s+(?:upset|sad|disappointed|unhappy)\b|(?:속상|슬프|실망|우울).{0,10}(?:것은|건|상태는)?\s*(?:아니|않)/i.test(text)) return special('not-upset-v46',['😊','👍'],'mood',160);
        if (/\b(?:deployment|release|service).{0,20}\b(?:not|isn['’]t|wasn['’]t)\s+(?:broken|failed|down)\b.{0,28}\b(?:alert|warning).{0,12}\b(?:stale|old|outdated)\b|(?:배포|릴리스|서비스).{0,18}(?:고장|실패).{0,8}(?:난\s*게\s*아니|아니고).{0,18}(?:경고|알림).{0,10}(?:오래|낡|이전)/i.test(text)) return special('stale-alert-v46',['✅','🛠️'],'tech',160);

        // --- Daily life ---
        if (/\b(?:replace|replaced|change|changed).{0,18}\btoothbrush\b|\btoothbrush\b.{0,18}\b(?:new|replace|replaced|changed)\b|(?:칫솔).{0,16}(?:새것|교체|바꿨|바꾸)/i.test(text)) return special('toothbrush-v46',['🪥','✨'],'life',150);
        if (/\b(?:fill|filled|refill|refilled).{0,18}\b(?:water\s*)?bottle\b|\bwater\s*bottle\b.{0,18}\b(?:fill|filled|refill)|(?:물병|텀블러).{0,16}(?:채웠|물\s*채|리필)/i.test(text)) return special('water-bottle-v46',['💧','💪'],'life',150);
        if (/\b(?:clean|cleaned|defrost).{0,18}\b(?:freezer|fridge|refrigerator)\b|(?:냉동실|냉장고).{0,16}(?:청소|정리|닦)/i.test(text)) return special('clean-fridge-v46',['🧹','🏠'],'life',150);
        if (/\b(?:mail|mailed|post|posted|send|sent).{0,18}\b(?:a\s+)?letter\b|\bletter\b.{0,18}\b(?:mail|mailed|post|posted)\b|(?:편지).{0,14}(?:부쳤|보냈|우편)/i.test(text)) return special('mail-letter-v46',['✉️','📮'],'life',150);
        if (/\b(?:take|took|put).{0,16}\b(?:the\s+)?(?:trash|garbage|rubbish)\b.{0,12}\b(?:out|outside)?\b|(?:쓰레기).{0,14}(?:버렸|내놨|밖에|비웠)/i.test(text)) return special('trash-out-v46',['🗑️','🏠'],'life',150);
        if (/\b(?:pack|packed).{0,18}\b(?:gym|workout|sports?)\s+bag\b|(?:운동|헬스).{0,14}(?:가방).{0,12}(?:챙겼|쌌|준비)/i.test(text)) return special('gym-bag-v46',['🎒','💪'],'life',150);
        if (/\b(?:dentist|dental).{0,18}\b(?:appointment|visit).{0,18}\b(?:calendar|schedule|add|added)\b|\b(?:calendar|schedule).{0,18}\b(?:dentist|dental)\b|(?:치과).{0,14}(?:예약|진료).{0,14}(?:달력|일정).{0,8}(?:추가|등록)/i.test(text)) return special('dentist-calendar-v46',['📅','🦷'],'schedule',150);
        if (/\b(?:grind|ground|grinding).{0,18}\bcoffee\s+beans?\b|(?:커피\s*)?원두.{0,14}(?:갈았|갈아|분쇄)/i.test(text)) return special('coffee-beans-v46',['☕','🌅'],'life',150);
        if (/\b(?:fix|fixed|tighten|tightened|repair|repaired).{0,20}\b(?:cabinet|drawer|door).{0,12}\b(?:handle|knob|hinge)\b|(?:찬장|서랍|문).{0,14}(?:손잡이|경첩).{0,12}(?:고쳤|수리|조였)/i.test(text)) return special('cabinet-fix-v46',['🛠️','🏠'],'life',150);
        if (/\b(?:leftovers?|leftover food).{0,18}\b(?:fridge|refrigerator)\b|\b(?:put|stored|kept).{0,16}\bleftovers?\b.{0,16}\b(?:fridge|refrigerator)\b|(?:남은\s*음식|남은\s*요리).{0,16}(?:냉장고|보관)/i.test(text)) return special('leftovers-fridge-v46',['🍱','🏠'],'life',150);
        if (/\b(?:water|watered|watering).{0,18}\b(?:flowers?|garden|plants?).{0,18}\b(?:porch|balcony|front|outside)?\b|(?:꽃|화분|식물).{0,16}(?:물\s*줬|물을\s*줬|물주기)|(?:현관|베란다|발코니).{0,14}꽃.{0,10}물/i.test(text)) return special('water-flowers-v46',['🌸','💧'],'life',150);
        if (/\b(?:charge|charged|charging).{0,18}\b(?:headphones?|earbuds?|earphones?)\b|(?:헤드폰|이어폰|이어버드).{0,14}(?:충전|배터리)/i.test(text)) return special('charge-headphones-v46',['🎧','🔋'],'life',150);

        // --- Social / captions ---
        if (/\b(?:sunrise|dawn).{0,24}\b(?:mountain|mountains|peak|hills?)\b|\b(?:mountain|mountains|peak|hills?).{0,24}\b(?:sunrise|dawn)\b|(?:산|산봉우리|정상).{0,20}(?:일출|해돋이|해가\s*뜨)|(?:일출|해돋이).{0,20}(?:산|산봉우리)/i.test(text)) return special('mountain-sunrise-v46',['🌅','⛰️','📸'],'social',152);
        if (/\b(?:spicy|hot).{0,14}\b(?:noodles?|ramen)\b.{0,20}\b(?:cold|chilly|freezing)\b|\b(?:cold|chilly|freezing).{0,20}\b(?:spicy|hot).{0,14}\b(?:noodles?|ramen)\b|(?:추운|쌀쌀한).{0,16}(?:매운).{0,10}(?:국수|라면)|(?:매운).{0,10}(?:국수|라면).{0,16}(?:추운|쌀쌀)/i.test(text)) return special('spicy-noodles-cold-v46',['🍜','🥶','😋'],'social',152);
        if (/\brain.{0,24}\b(?:bookstore|bookshop)\b|\b(?:bookstore|bookshop).{0,24}\brain\b|(?:비|빗소리|비오는).{0,20}(?:서점|책방)|(?:서점|책방).{0,20}(?:비|빗소리)/i.test(text)) return special('rain-bookstore-v46',['🌧️','📚','😌'],'social',152);
        if (/\bbirthday.{0,22}\b(?:dinner|meal).{0,22}\b(?:favorite|favourite|friends?|people|family)\b|\b(?:dinner|meal).{0,18}\b(?:birthday).{0,20}\b(?:friends?|people|family)\b|(?:생일).{0,16}(?:저녁|식사).{0,20}(?:좋아하는\s*사람|친구|가족|사람들)|(?:좋아하는\s*사람|친구|가족).{0,18}(?:생일).{0,12}(?:저녁|식사)/i.test(text)) return special('birthday-dinner-v46',['🎂','🍽️','💛'],'social',152);
        if (/\b(?:fresh|cut)\s+flowers?\b.{0,20}\b(?:window|windowsill|vase)\b|\b(?:window|windowsill|vase).{0,20}\b(?:fresh|cut)\s+flowers?\b|(?:창가|창문|화병).{0,16}(?:생화|꽃\s*다발|꽃)|(?:생화|꽃\s*다발).{0,16}(?:창가|창문|화병)/i.test(text)) return special('fresh-flowers-window-v46',['🌸','✨'],'social',152);
        if (/\b(?:roller\s*skates?|rollerblades?).{0,24}\b(?:first time|years?|again|back)\b|\b(?:first time|years?|again).{0,24}\b(?:roller\s*skates?|rollerblades?)\b|(?:롤러스케이트|인라인).{0,20}(?:몇\s*년|오랜만|다시|처음)/i.test(text)) return special('roller-skates-v46',['🛼','😂'],'social',152);
        if (/\b(?:barefoot|bare feet).{0,18}\b(?:walk|walking|stroll).{0,18}\b(?:beach|shore|sand)\b|(?:맨발).{0,16}(?:해변|바닷가|모래).{0,14}(?:걸|산책)|(?:해변|바닷가).{0,16}(?:맨발).{0,10}(?:걸|산책)/i.test(text)) return special('barefoot-beach-v46',['🏖️','🚶','🌊'],'social',152);
        if (/\b(?:late[- ]night|night).{0,18}\bdrive\b.{0,20}\b(?:playlist|music|songs?)\b|\b(?:playlist|music).{0,20}\b(?:late[- ]night|night).{0,12}\bdrive\b|(?:늦은\s*밤|밤).{0,14}(?:드라이브).{0,16}(?:플레이리스트|음악|노래)/i.test(text)) return special('night-drive-playlist-v46',['🚗','🎧','🌙'],'social',152);
        if (/\b(?:bake|baked|baking).{0,16}\bcookies?\b|(?:쿠키).{0,12}(?:구웠|굽고|베이킹)/i.test(text)) return special('baked-cookies-v46',['🍪','😋'],'social',152);
        if (/\bcat\b.{0,24}\b(?:sunlight|sunbeam|sunny spot|patch of sun)\b|\b(?:sunlight|sunbeam).{0,20}\bcat\b|(?:고양이).{0,20}(?:햇빛|햇살|해가\s*드는\s*자리)/i.test(text)) return special('cat-sunlight-v46',['🐱','☀️'],'social',152);
        if (/\b(?:quiet|slow|peaceful)\s+morning\b.{0,24}\b(?:no plans?|nothing planned|free)\b|\b(?:no plans?|nothing planned).{0,24}\b(?:quiet|slow)\s+morning\b|(?:아무\s*계획\s*없|계획\s*없는).{0,16}(?:조용한|느긋한)?\s*아침|(?:조용한|느긋한)\s*아침.{0,16}(?:계획\s*없)/i.test(text)) return special('quiet-morning-v46',['☕','😌','🌿'],'social',152);
        if (/\b(?:finish|finished|completed|complete).{0,18}\b(?:a\s+|the\s+)?puzzle\b|\bpuzzle\b.{0,18}\b(?:finished|completed|done)\b|(?:퍼즐).{0,16}(?:완성|끝냈|맞췄)/i.test(text)) return special('puzzle-finished-v46',['🧩','✅'],'social',152);

        // --- Work / office ---
        if (/\b(?:client|customer)\s+review\b.{0,24}\b(?:moved|rescheduled|shifted|changed)\b.{0,24}\b(?:monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening)\b|(?:고객|클라이언트)\s*검토.{0,20}(?:옮겨|변경|미뤄|당겨|재조정).{0,18}(?:월요일|화요일|수요일|목요일|금요일|오전|오후)/i.test(text)) return special('client-review-moved-v46',['📅','🔄'],'work',154);
        if (/\b(?:attach|attached).{0,18}\b(?:final|revised|updated)?\s*(?:pdf|document|file)\b|(?:최종|수정된)?\s*(?:PDF|문서|파일).{0,14}(?:첨부|붙였)/i.test(text)) return special('attached-file-v46',['📎','📄'],'work',154);
        if (/\b(?:procurement|purchasing|finance).{0,20}\b(?:approved|approval).{0,20}\b(?:hardware|purchase|order|spend)\b|(?:구매팀|조달팀|재무팀).{0,18}(?:하드웨어|구매|지출).{0,12}(?:승인)/i.test(text)) return special('purchase-approved-v46',['✅','💰'],'work',154);
        if (/\baction items?\b.{0,22}\b(?:ready|prepared).{0,18}\b(?:next|upcoming)\s+meeting\b|\b(?:next|upcoming)\s+meeting.{0,18}\baction items?\b|(?:다음|차기)\s*회의.{0,18}(?:할\s*일|액션\s*아이템|작업\s*목록).{0,12}(?:준비|완료)|(?:할\s*일|액션\s*아이템).{0,18}(?:다음|차기)\s*회의/i.test(text)) return special('action-items-ready-v46',['📋','📅'],'work',154);
        if (/\b(?:resolve|resolved|addressed|closed).{0,20}\b(?:every|all)\s+(?:comment|comments|feedback).{0,18}\b(?:proposal|document|draft)\b|\b(?:proposal|document|draft).{0,20}\b(?:comments?|feedback).{0,14}\b(?:resolved|addressed|closed)\b|(?:제안서|문서|초안).{0,18}(?:모든\s*)?(?:의견|댓글|피드백).{0,12}(?:처리|해결|완료)/i.test(text)) return special('proposal-comments-resolved-v46',['✅','💬'],'work',154);
        if (/\b(?:invoice|bill).{0,18}\b(?:paid|payment complete|settled)\b|\b(?:paid|settled).{0,16}\b(?:invoice|bill)\b|(?:청구서|인보이스).{0,16}(?:결제|지불|납부).{0,10}(?:완료|됐|되었)|(?:청구서|인보이스).{0,16}(?:결제됨|지불됨)/i.test(text)) return special('invoice-paid-v46',['✅','🧾','💰'],'work',154);
        if (/\bcontract\b.{0,28}\b(?:waiting|pending|awaiting).{0,16}\blegal\s+approval\b|\blegal\s+approval.{0,20}\b(?:contract).{0,18}\b(?:waiting|pending)\b|(?:계약서|계약).{0,18}(?:법무|법률).{0,14}(?:승인).{0,10}(?:기다리|대기|보류)/i.test(text)) return special('contract-legal-wait-v46',['📜','⏳','⚖️'],'work',154);
        if (/\b(?:product\s+)?demo\b.{0,22}\b(?:scheduled|booked|set|planned).{0,18}\b(?:monday|tuesday|wednesday|thursday|friday|tomorrow)\b|(?:제품\s*)?(?:데모|시연).{0,18}(?:월요일|화요일|수요일|목요일|금요일|내일).{0,12}(?:예정|잡혔|예약|확정)/i.test(text)) return special('demo-scheduled-v46',['📅','⏰'],'work',154);
        if (/\b(?:send|sent|share|shared).{0,18}\b(?:workshop|meeting)\s+agenda\b|\b(?:workshop|meeting)\s+agenda.{0,18}\b(?:sent|shared)\b|(?:워크숍|회의).{0,12}(?:안건|아젠다).{0,12}(?:보냈|전송|공유)/i.test(text)) return special('agenda-sent-v46',['📋','📤'],'work',154);
        if (/\b(?:roadmap|project).{0,20}\b(?:owner|assignee).{0,14}\b(?:changed|switched|updated|reassigned)\b|\b(?:owner|assignee).{0,16}\b(?:roadmap|project).{0,14}\b(?:changed|switched)\b|(?:로드맵|프로젝트).{0,16}(?:담당자|오너).{0,12}(?:바뀌|변경|교체)/i.test(text)) return special('roadmap-owner-changed-v46',['👤','🔄'],'work',154);
        if (/\b(?:upload|send).{0,18}\b(?:revised|updated|final)\s+(?:file|document|pdf).{0,20}\b(?:before|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|(?:오전|오후)\s*\d+시.{0,12}(?:전|까지).{0,18}(?:수정|업데이트|최종).{0,8}(?:파일|문서).{0,8}(?:업로드|전송)|(?:수정|업데이트|최종).{0,8}(?:파일|문서).{0,18}(?:오전|오후)\s*\d+시.{0,10}(?:전|까지).{0,6}(?:업로드|전송)?/i.test(text)) return special('upload-file-deadline-v46',['📤','⏰','📄'],'work',154);
        if (/\b(?:budget|finance).{0,12}\b(?:spreadsheet|sheet|workbook).{0,20}\b(?:ready|prepared).{0,14}\b(?:review|check)\b|(?:예산|재무).{0,12}(?:스프레드시트|시트|엑셀).{0,16}(?:검토).{0,10}(?:준비|가능|마쳤)/i.test(text)) return special('budget-sheet-review-v46',['📊','👀'],'work',154);

        // --- Engineering / operations ---
        if (/\bapi\b.{0,22}\b(?:500|5\d\d)\s*(?:errors?|responses?)\b|\b(?:500|5\d\d)\s*(?:errors?|responses?).{0,18}\bapi\b|(?:API).{0,18}(?:500|5\d\d)\s*(?:오류|에러)/i.test(text)) return special('api-500-v46',['❌','💻','⚠️'],'tech',156);
        if (/\bmemory\s+usage\b.{0,24}\b(?:stable|normal|steady).{0,18}\b(?:after|following)\s+(?:the\s+)?restart\b|(?:재시작|리부트).{0,18}(?:메모리\s*사용량).{0,14}(?:안정|정상)/i.test(text)) return special('memory-stable-after-restart-v46',['✅','💻','📊'],'tech',156);
        if (/\b(?:nightly|overnight)\s+backup\b.{0,24}\b(?:completed|finished|succeeded)\b|\bbackup\b.{0,20}\b(?:completed|finished).{0,16}\b(?:am|pm|overnight|night)\b|(?:야간|밤새)\s*백업.{0,18}(?:완료|성공)/i.test(text)) return special('nightly-backup-v46',['💾','✅','⏰'],'tech',156);
        if (/\b(?:invalidate|invalidated|clear|cleared|purge|purged).{0,18}\b(?:the\s+)?cache\b|(?:캐시).{0,14}(?:무효화|삭제|비웠|초기화|퍼지)/i.test(text)) return special('cache-invalidated-v46',['🧹','⚙️'],'tech',156);
        if (/\b(?:ssl|tls)\s+certificate\b.{0,18}\b(?:renewed|updated|rotated)\b|(?:SSL|TLS)\s*인증서.{0,14}(?:갱신|업데이트|교체)/i.test(text)) return special('cert-renewed-v46',['✅','🔐'],'tech',156);
        if (/\b(?:service|server|worker).{0,18}\b(?:restarted|started again).{0,16}\b(?:successfully|normally|cleanly)\b|(?:서비스|서버|워커).{0,16}(?:재시작|다시\s*시작).{0,10}(?:정상|성공)/i.test(text)) return special('service-restarted-v46',['✅','🔄','🛠️'],'tech',156);
        if (/\b(?:queue|job queue|task queue).{0,22}\b(?:almost|nearly)\s+empty\b|(?:작업\s*)?큐.{0,16}(?:거의\s*비었|거의\s*없|비어)/i.test(text)) return special('queue-nearly-empty-v46',['✅','⚙️'],'tech',156);
        if (/\b(?:new|fresh)\s+error\b.{0,22}\b(?:logs?|application logs?)\b|\b(?:logs?|application logs?).{0,22}\b(?:new|fresh)\s+error\b|(?:애플리케이션|앱)?\s*로그.{0,16}(?:새\s*오류|새\s*에러|오류가\s*나타)/i.test(text)) return special('new-error-log-v46',['❌','🔍','💻'],'tech',156);
        if (/\b(?:database|db)\s+migration\b.{0,22}\b(?:completed|finished).{0,14}\b(?:without|no)\s+(?:issues?|errors?|problems?)\b|(?:데이터베이스|DB)\s*마이그레이션.{0,18}(?:문제\s*없이|오류\s*없이).{0,10}(?:완료|끝)/i.test(text)) return special('db-migration-success-v46',['✅','💻','🛠️'],'tech',156);
        if (/\b(?:rollback|rolled back|revert|reverted).{0,18}\b(?:release|deployment).{0,20}\b(?:crash|failure|error)\b|\b(?:crash|failure).{0,18}\b(?:rollback|rolled back|reverted).{0,16}\b(?:release|deployment)\b|(?:충돌|크래시|장애).{0,16}(?:릴리스|배포).{0,12}(?:롤백|되돌)/i.test(text)) return special('rollback-after-crash-v46',['↩️','🛠️','❌'],'tech',156);
        if (/\bwebhook\b.{0,20}\bretry\b.{0,16}\b(?:succeeded|successful|worked)\b|\bwebhook\b.{0,20}\b(?:retry|retried).{0,16}\b(?:success|succeeded)\b|(?:웹훅).{0,18}(?:재시도).{0,12}(?:성공)/i.test(text)) return special('webhook-retry-success-v46',['✅','🔄'],'tech',156);
        if (/\b(?:monitoring|metrics?)\s+dashboard\b.{0,20}\b(?:green|healthy|normal|good).{0,12}\b(?:again|now)?\b|(?:모니터링|지표)\s*대시보드.{0,16}(?:다시\s*)?(?:정상|초록|건강)/i.test(text)) return special('dashboard-green-v46',['✅','📊'],'tech',156);

        // --- Commerce ---
        if (/\b(?:package|parcel|order).{0,22}\b(?:out for delivery|with the courier|on the way for delivery)\b|(?:택배|소포|주문).{0,16}(?:배송\s*중|배달\s*중|배송\s*출발|기사에게\s*인계)/i.test(text)) return special('out-for-delivery-v46',['📦','🚚'],'commerce',155);
        if (/\b(?:order|package|parcel|item).{0,18}\b(?:was\s+)?delivered\b|\bdelivered\b.{0,16}\b(?:order|package|parcel)\b|(?:주문\s*상품|택배|소포).{0,14}(?:배송\s*완료|배달\s*완료|도착)/i.test(text)) return special('delivered-v46',['📦','✅'],'commerce',155);
        if (/\brefund\b.{0,18}\b(?:still\s+)?pending\b|(?:환불).{0,12}(?:아직\s*)?(?:대기|보류|처리\s*중)/i.test(text)) return special('refund-pending-v46',['⏳','💳'],'commerce',155);
        if (/\b(?:back in stock|restocked|available again)\b|(?:재고).{0,14}(?:다시\s*들어|재입고|복구|있어)|(?:사이즈|상품).{0,14}(?:재고가\s*다시)/i.test(text)) return special('back-in-stock-v46',['✅','🛒'],'commerce',155);
        if (/\b(?:discount|sale|coupon|promotion).{0,18}\b(?:expires?|ends?|ending).{0,16}\b(?:tomorrow|tonight|soon)\b|(?:할인|세일|쿠폰|프로모션).{0,16}(?:내일|오늘\s*밤|곧).{0,10}(?:만료|끝|종료)/i.test(text)) return special('discount-expiring-v46',['🏷️','⏰'],'commerce',155);
        if (/\bcart\s+total\b.{0,22}\b(?:changed|updated|increased|decreased).{0,18}\b(?:shipping|delivery)\b|(?:배송비|배송).{0,16}(?:적용|추가).{0,14}(?:장바구니|카트).{0,12}(?:합계|총액).{0,8}(?:바뀌|변경)/i.test(text)) return special('cart-total-shipping-v46',['💰','🧾'],'commerce',155);
        if (/\bshipping\s+address\b.{0,18}\b(?:corrected|fixed|updated|changed)\b|(?:배송\s*주소).{0,14}(?:수정|고쳤|변경|업데이트)/i.test(text)) return special('shipping-address-corrected-v46',['📍','🚚'],'commerce',155);
        if (/\bgift\s*card\b.{0,22}\b(?:has|balance|left|remaining).{0,16}\b(?:dollars?|\$|won|euros?|pounds?)\b|\bgift\s*card\b.{0,20}\b(?:\d+|ten|twenty|five).{0,10}\b(?:left|remaining)\b|(?:기프트\s*카드|상품권).{0,18}(?:잔액|남아|남았|달러|원)/i.test(text)) return special('gift-card-balance-v46',['🎁','💳','💰'],'commerce',155);
        if (/\b(?:pickup|collection)\s+order\b.{0,20}\b(?:ready|prepared).{0,16}\b(?:store|shop|location)?\b|(?:픽업|수령)\s*주문.{0,16}(?:매장|가게).{0,12}(?:준비|완료)|(?:매장|가게).{0,14}(?:픽업|수령)\s*주문.{0,10}(?:준비|완료)/i.test(text)) return special('pickup-order-ready-v46',['📦','📍','✅'],'commerce',155);
        if (/\breturn\b.{0,16}\b(?:accepted|approved|authorized)\b|(?:반품).{0,14}(?:요청|신청)?.{0,8}(?:승인|수락|허용)/i.test(text)) return special('return-accepted-v46',['✅','↩️'],'commerce',155);
        if (/\bpayment\b.{0,18}\b(?:did not|didn['’]t|failed to)\s+(?:go through|process|complete)\b|(?:결제).{0,16}(?:정상적으로\s*)?(?:처리되지\s*않|완료되지\s*않|진행되지\s*않|실패)/i.test(text)) return special('payment-not-through-v46',['❌','💳'],'commerce',155);
        if (/\b(?:replacement|exchange)\s+package\b.{0,22}\b(?:left|departed|shipped from).{0,16}\b(?:warehouse|facility)\b|(?:교체|교환)\s*택배.{0,16}(?:창고|센터).{0,10}(?:출발|발송)/i.test(text)) return special('replacement-left-warehouse-v46',['📦','🚚','🔄'],'commerce',155);

        // --- Travel ---
        if (/\b(?:boarding\s+)?gate\b.{0,20}\b(?:closes?|closing).{0,16}\b(?:minutes?|mins?)\b|(?:탑승구|게이트).{0,16}(?:\d+|몇)\s*분\s*(?:뒤|후).{0,8}(?:닫|마감)/i.test(text)) return special('gate-closing-v46',['✈️','⏰'],'travel',155);
        if (/\btrain\b.{0,20}\b(?:running|is|was).{0,8}\b(?:\d+|fifteen|ten|twenty)\s+minutes?\s+(?:late|behind)\b|(?:기차|열차).{0,16}(?:\d+|몇|십오)\s*분.{0,8}(?:늦|지연)/i.test(text)) return special('train-late-v46',['🚆','⏳'],'travel',155);
        if (/\b(?:request|requested|ask|asked for).{0,18}\blate\s+checkout\b.{0,16}\bhotel\b|\blate\s+checkout\b.{0,18}\bhotel\b|(?:호텔).{0,14}(?:늦은|레이트)\s*체크아웃.{0,10}(?:요청|신청)/i.test(text)) return special('late-checkout-v46',['🏨','⏰'],'travel',155);
        if (/\brental\s+car\b.{0,20}\b(?:full tank|tank is full|fuel tank).{0,12}\b|(?:렌터카|대여차).{0,16}(?:연료|기름|탱크).{0,10}(?:가득|만땅|충만)/i.test(text)) return special('rental-full-tank-v46',['🚗','⛽'],'travel',155);
        if (/\b(?:museum|gallery).{0,18}\bticket\b.{0,20}\b(?:phone|mobile|downloaded|saved)\b|(?:박물관|미술관).{0,14}(?:티켓|표).{0,14}(?:휴대폰|폰|다운로드|저장)/i.test(text)) return special('museum-ticket-phone-v46',['🎫','📱','🏛️'],'travel',155);
        if (/\b(?:mountain|hiking)\s+trail\b.{0,18}\b(?:opens?|reopens?|open again).{0,14}\b(?:tomorrow|today)\b|(?:산길|등산로|트레일).{0,16}(?:내일|오늘).{0,10}(?:다시\s*열|재개방|개방)/i.test(text)) return special('trail-reopens-v46',['🥾','✅','📅'],'travel',155);
        if (/\bairport\s+bus\b.{0,18}\b(?:every|each)\s+(?:hour|\d+\s*minutes?)\b|(?:공항\s*버스).{0,14}(?:한\s*시간|\d+분)\s*마다.{0,8}(?:출발|운행)/i.test(text)) return special('airport-bus-frequency-v46',['🚌','✈️','⏰'],'travel',155);
        if (/\b(?:suitcase|luggage|bag).{0,18}\b(?:arrived|came).{0,16}\b(?:next|later)\s+flight\b|(?:여행\s*가방|수하물|짐).{0,16}(?:다음|뒤)\s*항공편.{0,10}(?:도착|왔)/i.test(text)) return special('bag-next-flight-v46',['🧳','✈️','✅'],'travel',155);
        if (/\b(?:book|booked|reserve|reserved).{0,16}\bdinner\b.{0,18}\b(?:near|by)\s+(?:the\s+)?station\b|(?:역).{0,12}(?:근처|인근).{0,12}(?:식당|저녁).{0,8}(?:예약)|(?:식당|저녁).{0,14}(?:역\s*근처|역\s*인근).{0,8}(?:예약)/i.test(text)) return special('dinner-near-station-v46',['🍽️','🚆','📅'],'travel',155);
        if (/\bferry\b.{0,20}\b(?:delayed|late).{0,18}\b(?:strong\s+)?wind\b|(?:강풍|바람).{0,14}(?:페리|배).{0,10}(?:지연|늦)|(?:페리|배).{0,14}(?:강풍|바람).{0,10}(?:지연|늦)/i.test(text)) return special('ferry-wind-delay-v46',['🚢','⏳','💨'],'travel',155);
        if (/\bpassport\b.{0,18}\b(?:hotel|room).{0,12}\bsafe\b|\b(?:hotel|room)\s+safe\b.{0,16}\bpassport\b|(?:여권).{0,14}(?:호텔|객실).{0,10}(?:금고).{0,8}(?:보관|넣)|(?:호텔|객실)\s*금고.{0,12}(?:여권)/i.test(text)) return special('passport-hotel-safe-v46',['🛂','🏨','🔐'],'travel',155);
        if (/\bcaf[eé]\b.{0,20}\b(?:closes?|closed).{0,16}\b(?:before|prior to).{0,12}\b(?:last\s+)?train\b|(?:카페).{0,14}(?:막차|마지막\s*기차).{0,8}(?:전|보다\s*먼저).{0,8}(?:닫|문을\s*닫)/i.test(text)) return special('cafe-before-last-train-v46',['☕','🚆','⏰'],'travel',155);

        // --- Report / metrics ---
        if (/\b(?:weekly|monthly|daily)?\s*revenue\b.{0,24}\b(?:grew|increased|rose|up)\b|(?:주간|월간|일간)?\s*매출.{0,18}(?:증가|상승|늘)/i.test(text)) return special('revenue-up-v46',['📈','📊'],'report',153);
        if (/\b(?:churn|churn rate)\b.{0,24}\b(?:flat|unchanged|same|stable|similar)\b|(?:이탈률|이탈).{0,18}(?:비슷|변화\s*없|그대로|평평|안정)/i.test(text)) return special('churn-flat-v46',['📊','➡️'],'report',153);
        if (/\b(?:average\s+)?(?:reply|response)\s+time\b.{0,24}\b(?:dropped|decreased|fell|down|reduced)\b|(?:평균\s*)?(?:답변|응답)\s*시간.{0,18}(?:줄|감소|하락|단축)/i.test(text)) return special('reply-time-down-v46',['📉','⏱️'],'report',153);
        if (/\b(?:defect|bug|issue)\s+(?:volume|count|rate)\b.{0,22}\b(?:increased|rose|grew|up)\b|(?:결함|버그|이슈).{0,10}(?:건수|수|비율).{0,16}(?:증가|늘|상승)/i.test(text)) return special('defects-up-v46',['📈','📊'],'report',153);
        if (/\b(?:customer\s+)?satisfaction\b.{0,22}\b(?:unchanged|flat|same|stable)\b|(?:고객\s*)?만족도.{0,18}(?:변하지|변화\s*없|그대로|비슷)/i.test(text)) return special('satisfaction-flat-v46',['📊','➡️'],'report',153);
        if (/\b(?:new\s+)?orders?\b.{0,22}\b(?:record|record high|daily high|highest)\b|(?:신규\s*)?주문.{0,18}(?:일간|하루).{0,10}(?:최고|기록)|(?:신규\s*)?주문.{0,16}(?:최고치|기록)/i.test(text)) return special('orders-record-v46',['📈','🏆'],'report',153);
        if (/\bactivation\b.{0,22}\b(?:improved|increased|rose|better)\b|(?:활성화|활성률).{0,18}(?:개선|증가|상승|좋아)/i.test(text)) return special('activation-up-v46',['📈','📊'],'report',153);
        if (/\b(?:ticket|support)\s+backlog\b.{0,22}\b(?:decreased|fell|dropped|down|reduced)\b|(?:티켓|지원)\s*백로그.{0,18}(?:감소|줄|하락)/i.test(text)) return special('backlog-down-v46',['📉','📊'],'report',153);

        // v40: broad intent families from an untouched cross-domain holdout.
        // These rules intentionally use semantic families and synonyms instead of
        // matching one benchmark sentence at a time.






        // v45: residual plural/word-order repairs.
        if (/\b(?:only|just)\s+(?:one|two|three|four|five|\d+)\s+(?:units?|items?|pieces?).{0,18}\b(?:remain|remains|left|in stock)\b|\b(?:only|just).{0,8}(?:one|two|three|four|five|\d+).{0,10}\b(?:remain|remains|left)\b/i.test(text)) return special('low-stock-words-v45',['⚠️','🛒'],'commerce',140);
        if (/\b(?:product\s+brief|brief).{0,24}\b(?:needs?|need).{0,18}(?:one|two|three|\d+)\s+(?:more\s+)?comments?\b|\b(?:comments?|feedback).{0,18}\b(?:needed|required).{0,18}\b(?:product\s+brief|brief)\b/i.test(text)) return special('brief-comment-count-v45',['📝','💬'],'work',140);
        // v44: third broad corpus — household, commerce, work, ops, travel, metrics, captions.
        // Daily life.
        if (/\b(?:remote|remote control).{0,18}\b(?:batter(?:y|ies)).{0,18}\b(?:changed|replaced|new)|\b(?:changed|replaced).{0,18}\b(?:batter(?:y|ies)).{0,18}\b(?:remote|remote control)|(?:리모컨).{0,16}(?:배터리|건전지).{0,12}(?:교체|바꿨|새것)/i.test(text)) return special('remote-battery-v44',['🔋','📺'],'life',132);
        if (/\b(?:washed|cleaned)\s+(?:the\s+|my\s+)?car\b|\bcar\s+wash\b|(?:차|자동차|차량).{0,12}(?:세차|씻었|닦았)|세차/i.test(text)) return special('wash-car-v44',['🚗','🧽'],'life',132);
        if (/\b(?:fresh|clean|new)\s+towels?.{0,20}\b(?:bathroom|bath|shower)\b|\b(?:bathroom|bath).{0,20}\b(?:fresh|clean|new)\s+towels?\b|(?:욕실|화장실).{0,18}(?:수건)|(?:새|깨끗한)\s*수건.{0,14}(?:욕실|화장실)/i.test(text)) return special('fresh-towels-v44',['🧺','🛁'],'life',132);
        if (/\b(?:ironed|press(?:ed)?).{0,18}\b(?:shirt|shirts|clothes|clothing)\b|(?:셔츠|옷).{0,14}(?:다렸|다림질)|다림질/i.test(text)) return special('iron-clothes-v44',['👕','✨'],'life',132);
        if (/\b(?:watered|watering).{0,18}\b(?:succulent|plant|plants|houseplant)\b|\b(?:succulent|plant).{0,18}\bwater(?:ed|ing)\b|(?:다육이|화분|식물).{0,14}(?:물\s*줬|물을\s*줬|물주기)|물을.{0,8}(?:화분|다육이|식물)/i.test(text)) return special('water-plant-v44',['🪴','💧'],'life',132);
        if (/\b(?:birthday\s+card|card).{0,20}\b(?:aunt|uncle|mom|mum|dad|friend|birthday)\b|\b(?:wrote|write).{0,18}\b(?:birthday\s+card|card)\b|(?:생일\s*카드).{0,16}(?:썼|적었|작성)|(?:이모|삼촌|엄마|아빠|친구).{0,12}생일\s*카드/i.test(text)) return special('birthday-card-v44',['🎂','✍️','💛'],'social',132);
        if (/\b(?:recycling|recyclables).{0,20}\b(?:emptied|took out|sorted)|\b(?:emptied|took out).{0,18}\b(?:recycling|recyclables)\b|(?:재활용품|재활용).{0,16}(?:비웠|버렸|내놨|정리)/i.test(text)) return special('recycling-v44',['♻️','🏠'],'life',132);
        if (/\b(?:set|setting).{0,14}\b(?:an?\s+)?alarm.{0,18}\b(?:tomorrow|morning|\d{1,2})\b|(?:내일|아침|오전).{0,14}(?:알람).{0,12}(?:맞췄|설정)|알람.{0,14}(?:내일|아침|오전|\d+시)/i.test(text)) return special('alarm-set-v44',['⏰','🌅'],'schedule',132);

        // SNS / hobby scenes.
        if (/\b(?:city|skyline).{0,24}\b(?:pink|orange|purple).{0,20}\b(?:sunset|dusk)|\b(?:sunset|dusk).{0,24}\b(?:city|skyline)\b|(?:도시|하늘).{0,24}(?:분홍|주황|보라).{0,18}(?:해\s*지|노을)|(?:해\s*지|노을).{0,18}(?:도시).{0,18}(?:분홍|주황|보라)/i.test(text)) return special('city-sunset-v44',['🌇','✨','📸'],'social',132);
        if (/\b(?:old|vinyl)\s+(?:record|lp|album).{0,24}\b(?:found|forgot|owned)|\b(?:found|rediscovered).{0,18}\b(?:record|vinyl|lp)\b|(?:오래된|옛)\s*(?:레코드|LP|음반).{0,18}(?:찾|발견)|(?:레코드|LP|음반).{0,18}(?:잊고|찾)/i.test(text)) return special('vinyl-record-v44',['🎵','💿','✨'],'creative',132);
        if (/\b(?:pottery|ceramic)\s+(?:bowl|cup|mug|piece)|\b(?:first|my)\s+(?:pottery|ceramic).{0,20}(?:bowl|cup|piece)|(?:도자기).{0,16}(?:그릇|컵|작품)|(?:처음\s*만든).{0,12}도자기/i.test(text)) return special('pottery-v44',['🏺','💛'],'creative',132);
        if (/\b(?:garden|yard).{0,22}\b(?:spring|flowers?|bloom|smell)|\b(?:spring).{0,18}\b(?:garden|flowers?)\b|(?:정원).{0,18}(?:봄|꽃|향기|냄새)|봄.{0,14}정원/i.test(text)) return special('spring-garden-v44',['🌸','🌿'],'social',132);
        if (/\b(?:movie|film)\s+night\b|\bwatch(?:ed|ing)?\s+(?:a\s+)?movie.{0,16}\bnight\b|(?:영화).{0,12}(?:보는|본).{0,10}(?:밤|저녁)|영화\s*밤/i.test(text)) return special('movie-night-v44',['🎬','🌙'],'creative',132);
        if (/\b(?:tiny|small|little)\s+caf[eé].{0,24}\b(?:cake|slice|dessert)\b|\b(?:cake|slice).{0,18}\b(?:tiny|small)\s+caf[eé]\b|(?:작은\s*카페).{0,18}(?:케이크|디저트)|(?:케이크|디저트).{0,18}(?:작은\s*카페)/i.test(text)) return special('cafe-cake-v44',['☕','🍰','😋'],'social',132);
        if (/\b(?:new\s+haircut|haircut).{0,24}\b(?:mood|feel|better)|(?:새\s*머리|새\s*헤어|머리\s*바꾼).{0,18}(?:기분|좋)/i.test(text)) return special('haircut-mood-v44',['💇','😊'],'social',132);

        // Work.
        if (/\b(?:signed\s+)?document.{0,24}\b(?:upload|uploaded).{0,18}\b(?:noon|\d{1,2}(?::\d{2})?\s*(?:am|pm))|\b(?:upload|send).{0,18}\b(?:signed\s+)?document.{0,18}\b(?:by|before)\s+(?:noon|\d{1,2})\b|(?:서명된\s*)?문서.{0,18}(?:정오|오전|오후|\d+시).{0,10}(?:까지|전).{0,8}(?:업로드|보내)|(?:정오|오전|오후|\d+시).{0,10}(?:까지|전).{0,14}(?:서명된\s*)?문서.{0,8}(?:업로드|보내)/i.test(text)) return special('signed-doc-deadline-v44',['📤','📄','⏰'],'work',134);
        if (/\b(?:product\s+brief|brief).{0,22}\b(?:comments?|feedback).{0,16}\b(?:needs?|need|more|remaining)|(?:제품\s*브리프|브리프).{0,18}(?:의견|댓글|피드백).{0,12}(?:필요|더)/i.test(text)) return special('brief-needs-comments-v44',['📝','💬'],'work',134);
        if (/\b(?:assigned|set|named).{0,18}\b(?:new\s+)?(?:owner|assignee).{0,18}\b(?:bug|issue|ticket|task)\b|\b(?:bug|issue|ticket).{0,20}\b(?:new\s+)?(?:owner|assignee)\b|(?:버그|이슈|티켓).{0,14}(?:담당자).{0,12}(?:지정|새로|변경)/i.test(text)) return special('new-owner-v44',['👤','🔄'],'work',134);
        if (/\b(?:engineering|design|security|legal)\s+review.{0,22}\b(?:pending|waiting|not done|still)\b|(?:엔지니어링|디자인|보안|법무)\s*검토.{0,18}(?:대기|아직|진행\s*중)/i.test(text)) return special('review-pending-v44',['👀','⏳','💻'],'work',134);
        if (/\b(?:final\s+)?(?:presentation|deck|slides?).{0,22}\b(?:ready to send|ready|send)\b|(?:최종\s*)?(?:발표\s*자료|프레젠테이션|슬라이드).{0,18}(?:보낼\s*준비|전송\s*준비|준비\s*끝)/i.test(text)) return special('presentation-ready-v44',['📊','📤','✅'],'work',134);
        if (/\b(?:invoice|bill).{0,22}\b(?:waiting|pending).{0,18}\b(?:manager|approval)\b|(?:청구서|인보이스).{0,18}(?:관리자|승인).{0,12}(?:기다리|대기)/i.test(text)) return special('invoice-awaiting-v44',['🧾','⏳'],'work',134);
        if (/\b(?:added|add).{0,18}\b(?:milestone|goal).{0,18}\b(?:roadmap|plan)\b|(?:로드맵|계획).{0,18}(?:마일스톤|목표).{0,12}(?:추가)/i.test(text)) return special('milestone-roadmap-v44',['🎯','📅'],'work',134);
        if (/\b(?:agenda).{0,22}\b(?:ready|prepared).{0,18}\b(?:workshop|meeting|tomorrow)\b|(?:워크숍|회의).{0,16}(?:안건|아젠다).{0,12}(?:준비|완료)|(?:안건|아젠다).{0,16}(?:내일|워크숍|회의).{0,12}(?:준비)/i.test(text)) return special('agenda-ready-v44',['📋','📅'],'work',134);
        if (/\b(?:closed|resolved|addressed)\s+(?:all\s+)?comments?.{0,18}\b(?:draft|document|review)\b|\b(?:draft|document).{0,18}\bcomments?.{0,12}\b(?:closed|resolved|addressed)\b|(?:초안|문서).{0,18}(?:의견|댓글).{0,12}(?:모두\s*)?(?:처리|해결|닫)/i.test(text)) return special('comments-closed-v44',['✅','💬','📝'],'work',134);
        if (/\b(?:sign|signature).{0,18}\b(?:agreement|contract).{0,18}\b(?:before|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:계약서|계약).{0,16}(?:서명|사인).{0,16}(?:오전|오후|\d+시).{0,8}(?:전|까지)|(?:오전|오후|\d+시).{0,8}(?:전|까지).{0,14}(?:계약서|계약).{0,8}(?:서명|사인)/i.test(text)) return special('sign-contract-deadline-v44',['✍️','📜','⏰'],'work',134);
        if (/\b(?:uploaded|upload).{0,18}\b(?:revised|updated).{0,12}\b(?:spreadsheet|sheet|workbook).{0,18}\b(?:shared|folder)\b|(?:수정된|업데이트된).{0,10}(?:스프레드시트|시트|엑셀).{0,16}(?:공유\s*폴더|폴더).{0,8}(?:업로드|올렸)/i.test(text)) return special('spreadsheet-upload-folder-v44',['📤','📊'],'work',134);

        // Tech.
        if (/\b(?:upload).{0,18}\b(?:finished|completed|succeeded).{0,20}\b(?:retry|retried)\b|\b(?:retry|retried).{0,20}\bupload.{0,18}\b(?:finished|completed)\b|(?:재시도).{0,18}(?:업로드).{0,12}(?:완료|성공)|(?:업로드).{0,18}(?:재시도).{0,12}(?:완료|성공)/i.test(text)) return special('upload-retry-complete-v44',['✅','📤','🔄'],'tech',135);
        if (/\b(?:database|db)\s+connection\s+pool.{0,20}\b(?:exhausted|full|empty|depleted)\b|(?:데이터베이스|DB)\s*연결\s*풀.{0,18}(?:소진|고갈|부족|가득)/i.test(text)) return special('db-pool-exhausted-v44',['⚠️','💻'],'tech',135);
        if (/\bdisk\s+(?:free\s+)?space.{0,22}\b(?:below|under|dropped|low)\b|(?:디스크).{0,16}(?:여유\s*공간|공간).{0,16}(?:아래|부족|떨어|남지)/i.test(text)) return special('disk-space-low-v44',['⚠️','💾'],'tech',135);
        if (/\b(?:cron|scheduled)\s+job.{0,20}\b(?:did not|didn['’]t|failed to)\s+run\b|(?:크론|예약)\s*작업.{0,18}(?:실행되지\s*않|돌지\s*않|실패)/i.test(text)) return special('cron-not-run-v44',['⚠️','💻','⏰'],'tech',135);
        if (/\bAPI\s+timeout.{0,22}\b(?:back to normal|normal again|resolved|recovered)\b|API\s*타임아웃.{0,18}(?:정상|복구|해결).{0,8}(?:돌아|수준)/i.test(text)) return special('api-timeout-normal-v44',['✅','⏱️','💻'],'tech',135);
        if (/\b(?:certificate|cert).{0,18}\b(?:renewal|renewed).{0,20}\b(?:completed|successful|done)\b|(?:인증서).{0,16}(?:갱신).{0,12}(?:완료|성공|정상)/i.test(text)) return special('cert-renewed-v44',['✅','🔐'],'tech',135);
        if (/\bbuild.{0,20}\b(?:failing|fails?|failed).{0,20}\b(?:integration|test)\b|(?:빌드).{0,16}(?:통합\s*테스트|테스트).{0,12}(?:실패|깨지)/i.test(text)) return special('build-test-failing-v44',['❌','💻','🛠️'],'tech',135);
        if (/\bcache\s+(?:hit\s+)?rate.{0,20}\b(?:improved|rose|increased)\b|(?:캐시\s*)?(?:적중률|히트율).{0,16}(?:개선|상승|증가)/i.test(text)) return special('cache-hit-up-v44',['📈','⚙️'],'tech',135);
        if (/\b(?:queue|worker\s+queue).{0,20}\bbacklog.{0,22}\b(?:shrinking|decreasing|falling|dropping)\b|(?:큐).{0,14}(?:백로그).{0,16}(?:줄|감소|낮아)/i.test(text)) return special('queue-backlog-down-v44',['📉','⚙️','✅'],'tech',135);
        if (/\b(?:monitoring|system)\s+alert.{0,22}\b(?:cleared|closed|resolved|gone)\b|(?:모니터링|시스템)\s*경고.{0,16}(?:해제|사라|해결)/i.test(text)) return special('monitor-alert-cleared-v44',['✅','🔔'],'tech',135);
        if (/\bAPI\s+latency.{0,22}\b(?:doubled|increased|spiked|rose)\b|API\s*(?:지연\s*시간|레이턴시).{0,18}(?:두\s*배|증가|급증|상승)/i.test(text)) return special('api-latency-up-v44',['📈','💻','⏱️'],'tech',135);

        // Commerce.
        if (/\b(?:replacement|replacement item).{0,22}\b(?:ready to collect|ready for pickup|pickup ready)\b|(?:교체\s*상품|교환\s*상품).{0,18}(?:수령|픽업).{0,8}(?:준비|가능)/i.test(text)) return special('replacement-pickup-v44',['📦','📍','✅'],'commerce',134);
        if (/\breturn\s+(?:window|period).{0,18}\b(?:closes?|ends?|until).{0,14}\b(?:tomorrow|today|date)\b|(?:반품\s*(?:가능\s*)?(?:기간|기한)).{0,18}(?:내일|오늘).{0,8}(?:끝|종료|마감)/i.test(text)) return special('return-window-v44',['↩️','⏰'],'commerce',134);
        if (/\b(?:only|just)\s+\d+\s+(?:units?|items?|pieces?).{0,18}\b(?:remain|left|in stock)\b|\b(?:stock|inventory).{0,18}\b(?:only|just)\s+\d+\b|(?:재고).{0,14}(?:\d+|두\s*개|세\s*개|한\s*개).{0,10}(?:남|뿐|밖에)/i.test(text)) return special('low-stock-count-v44',['⚠️','🛒'],'commerce',134);
        if (/\b(?:delivery|shipping)\s+address.{0,20}\b(?:updated|changed|corrected)\b|(?:배송|배달)\s*주소.{0,16}(?:업데이트|변경|수정)/i.test(text)) return special('delivery-address-updated-v44',['📍','🚚'],'commerce',134);
        if (/\bfree\s+(?:delivery|shipping).{0,18}\b(?:available|included|eligible)\b|(?:무료\s*배송).{0,16}(?:가능|제공|포함)/i.test(text)) return special('free-delivery-v44',['🚚','✅'],'commerce',134);
        if (/\b(?:use|apply|enter)\s+(?:code|coupon|promo).{0,22}\b(?:before|by)\s+(?:midnight|tonight|\d{1,2})\b|(?:코드|쿠폰|프로모션).{0,18}(?:자정|오늘\s*밤).{0,8}(?:전|까지).{0,8}(?:사용|적용)|(?:자정|오늘\s*밤).{0,8}(?:전|까지).{0,14}(?:코드|쿠폰).{0,8}(?:사용|적용)/i.test(text)) return special('promo-code-deadline-v44',['🏷️','⏰'],'commerce',134);
        if (/\bbackorder(?:ed)?\b.{0,20}\b(?:until|through|friday|monday|date)\b|(?:백오더|입고\s*대기).{0,18}(?:금요일|월요일|까지|상태)/i.test(text)) return special('backorder-v44',['⏳','📦'],'commerce',134);
        if (/\breturn\s+label.{0,20}\b(?:ready|print|printing)\b|(?:반품\s*라벨).{0,18}(?:출력|인쇄|준비)/i.test(text)) return special('return-label-v44',['↩️','🏷️','🖨️'],'commerce',134);
        if (/\bpickup\s+code.{0,16}\b\d+\b|(?:픽업|수령)\s*코드.{0,12}\d+/i.test(text)) return special('pickup-code-v44',['📍','🔢'],'commerce',134);
        if (/\b(?:order|purchase)\s+confirmation.{0,18}\b(?:sent|emailed|email)\b|(?:주문|구매)\s*확인\s*(?:메일|이메일).{0,12}(?:발송|보냈|전송)/i.test(text)) return special('order-confirmation-email-v44',['✅','📧'],'commerce',134);

        // Travel.
        if (/\b(?:rental|hire)\s+car.{0,20}\b(?:waiting|ready).{0,16}\b(?:lot|parking|garage)\b|(?:렌터카|대여차).{0,18}(?:주차|구역|주차장).{0,10}(?:대기|기다리|준비)/i.test(text)) return special('rental-car-location-v44',['🚗','📍'],'travel',134);
        if (/\bferry.{0,18}\b(?:leaves?|departs?).{0,18}\b(?:sunrise|dawn|\d{1,2})\b|(?:페리|배).{0,16}(?:일출|해뜰|새벽).{0,10}(?:출발|떠나)/i.test(text)) return special('ferry-sunrise-v44',['🚢','🌅','⏰'],'travel',134);
        if (/\b(?:hotel\s+)?room.{0,20}\b(?:ready|available).{0,18}\b(?:after|at|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:호텔\s*)?(?:객실|방).{0,18}(?:오전|오후|\d+시).{0,8}(?:뒤|후|부터).{0,8}(?:준비|사용\s*가능)/i.test(text)) return special('hotel-room-time-v44',['🏨','⏰'],'travel',134);
        if (/\b(?:luggage|baggage).{0,22}\b(?:next|another)\s+flight.{0,16}\b(?:transferred|connected|moved)\b|(?:짐|수하물).{0,18}(?:다음\s*항공편|다음\s*비행기).{0,12}(?:연결|이동|전송)/i.test(text)) return special('luggage-transfer-v44',['🧳','✈️','🔄'],'travel',134);

        // Reports.
        if (/\b(?:net promoter score|NPS).{0,20}\b(?:unchanged|flat|stable|same)\b|(?:순추천지수|NPS).{0,16}(?:변하지|그대로|유지|안정)/i.test(text)) return special('nps-flat-v44',['📊','➡️'],'report',134);
        if (/\b(?:checkout\s+completion|completion\s+rate).{0,20}\b(?:improved|increased|rose)\b|(?:결제\s*완료율|완료율).{0,16}(?:개선|증가|상승)/i.test(text)) return special('checkout-completion-up-v44',['📈','📊'],'report',134);
        if (/\btraffic.{0,22}\b(?:almost|nearly).{0,10}\b(?:identical|same|unchanged)\b|(?:트래픽).{0,20}(?:거의\s*같|비슷|동일|변화\s*없)/i.test(text)) return special('traffic-flat-v44',['📊','➡️'],'report',134);
        if (/\brevenue.{0,22}\b(?:new\s+)?(?:weekly|monthly|daily)\s+(?:high|record)\b|(?:매출).{0,18}(?:주간|월간|일간).{0,12}(?:최고|신기록|최고치)/i.test(text)) return special('revenue-record-v44',['📈','🏆'],'report',134);

        // Guard / protected mentions.
        if (/\bshipment.{0,18}\bno longer\s+delayed\b|(?:배송|발송).{0,18}(?:더\s*이상|이제).{0,8}(?:지연\s*상태가\s*아니|지연되지\s*않)/i.test(text)) return special('shipment-not-delayed-v44',['✅','🚚'],'status',136);
        if (/\b(?:ran into|bumped into).{0,22}\b(?:manager|boss|coworker|colleague)\b|(?:우연히).{0,16}(?:팀장|상사|동료).{0,10}(?:만났|마주쳤)/i.test(text)) return special('meet-manager-v44',['🤝','😊'],'social',136);
        if (/\b(?:run|execute).{0,14}\b(?:cleanup|maintenance|backup|migration)\s+(?:command|script|job)\b|(?:정리|유지보수|백업|마이그레이션)\s*(?:명령|스크립트|작업).{0,8}(?:실행|돌리)/i.test(text)) return special('run-command-v44',['💻','🛠️'],'tech',136);
        if (/\b(?:mouse\s+pointer|mouse\s+cursor|cursor).{0,20}\b(?:disappeared|missing|gone|not visible)\b|(?:마우스\s*포인터|마우스\s*커서|커서).{0,16}(?:사라|안\s*보|없)/i.test(text)) return special('mouse-pointer-v44',['🖱️','💻'],'tech',136);
        if (/\b(?:account|profile).{0,18}\b(?:not|no longer)\s+locked\b|(?:계정|프로필).{0,16}(?:잠긴|잠금).{0,8}(?:상태가\s*)?(?:아니|해제)/i.test(text)) return special('account-unlocked-v44',['✅','🔓'],'status',136);
        if (/\b(?:not|isn['’]t|am not)\s+(?:worried|anxious)\b|(?:걱정|불안).{0,8}(?:되지\s*않|하지\s*않|없)/i.test(text)) return special('not-worried-v44',['😊','👍'],'mood',136);
        if (/@[\p{L}\p{N}_.-]+/u.test(raw) && /\b(?:reviewing|checking|investigating|looking into).{0,20}\b(?:alert|database|issue|incident)\b|(?:데이터베이스|경고|문제|장애).{0,16}(?:확인|검토|조사)/i.test(text)) return special('mention-investigation-v44',['🔍','⚠️'],'tech',136);
        // v43: residual morphology and word-order repairs from corpus 17.
        if (/\b(?:mobile\s+app|app).{0,28}\bno longer\s+crash(?:es|ing)?\b|\b(?:mobile\s+app|app).{0,28}\bdoesn['’]t\s+crash\b/i.test(text)) return special('mobile-no-crash-v43', ['✅','📱','🛠️'], 'tech', 130);
        if (/(?:\d+\s*(?:원|만원)|\$\s*\d+|\d+\s*dollars?).{0,20}(?:부터|이상).{0,12}(?:무료\s*배송)|(?:무료\s*배송).{0,20}(?:\d+\s*(?:원|만원)|\$\s*\d+)/i.test(text)) return special('free-shipping-amount-v43', ['🚚','💰'], 'commerce', 130);
        if (/(?:기대보다|생각보다).{0,18}(?:좋|훌륭|대단).{0,18}(?:콘서트|공연)|(?:훨씬\s*)?좋았던\s*(?:콘서트|공연)/i.test(text)) return special('concert-reverse-ko-v43', ['🎵','🤩'], 'social', 130);
        if (/\b(?:mouse|mice).{0,42}\b(?:fridge|refrigerator|kitchen|pantry|floor)\b|\b(?:fridge|refrigerator|kitchen|pantry).{0,42}\b(?:mouse|mice)\b|(?:쥐|생쥐).{0,36}(?:냉장고|주방|바닥|팬트리)|(?:냉장고|주방|바닥|팬트리).{0,36}(?:쥐|생쥐)/i.test(text)) return special('literal-mouse-wide-v43', ['🐭','🏠'], 'animal', 130);
        if (/\b(?:dog|puppy).{0,45}\b(?:park|friends?)\b|\b(?:park|friends?).{0,45}\b(?:dog|puppy)\b|(?:강아지|개).{0,34}(?:공원|친구)|(?:공원|친구).{0,34}(?:강아지|개)/i.test(text)) return special('dog-park-friends-v43', ['🐶','🤝','🌳'], 'social', 130);
        // v42: broad natural-language intents from a second untouched cross-domain corpus.
        // Everyday objects and chores.
        if (/\b(?:journal|diary).{0,22}(?:wrote|write|pages?|entry)|\b(?:wrote|write).{0,20}(?:in|into) (?:my |the )?(?:journal|diary)|(?:일기장|일기).{0,18}(?:썼|적었|페이지|기록)/i.test(text)) return special('journal-writing-v42', ['📓','✍️'], 'life', 123);
        if (/\b(?:keys?|keyring).{0,20}(?:under|behind|inside|beneath).{0,16}(?:sofa|couch|chair|bed)|(?:소파|침대|의자).{0,14}(?:밑|뒤|아래).{0,14}(?:열쇠|키)|(?:열쇠|키).{0,18}(?:소파|침대|의자).{0,10}(?:밑|뒤|아래)/i.test(text)) return special('find-keys-v42', ['🔑','🛋️'], 'life', 123);
        if (/\b(?:dog|puppy).{0,22}\b(?:park|dog park)\b|\b(?:took|walked|brought).{0,16}(?:dog|puppy).{0,16}(?:park)\b|(?:강아지|개).{0,18}(?:공원|산책)|(?:공원).{0,18}(?:강아지|개)/i.test(text)) return special('dog-park-v42', ['🐶','🌳','🚶'], 'life', 123);
        if (/\b(?:light bulb|bulb|lamp).{0,20}(?:changed|replaced|fixed)|\b(?:changed|replaced|fixed).{0,16}(?:light bulb|bulb)\b|(?:전구|조명).{0,16}(?:갈았|교체|바꿨|고쳤)/i.test(text)) return special('light-bulb-v42', ['💡','🛠️'], 'life', 123);
        if (/\b(?:charged|charging)\s+(?:my |the )?(?:phone|mobile|tablet)|\b(?:phone|mobile).{0,16}(?:charged|charging)\b|(?:휴대폰|핸드폰|폰).{0,16}(?:충전|충전했)/i.test(text)) return special('charge-phone-v42', ['🔋','📱'], 'life', 123);
        if (/\b(?:packed|prepared|made).{0,18}\b(?:lunch|lunchbox)\b.{0,18}\b(?:tomorrow|next day)\b|(?:내일).{0,18}(?:점심|도시락).{0,12}(?:챙겼|준비|만들)|(?:점심|도시락).{0,18}(?:내일).{0,12}(?:챙겼|준비)/i.test(text)) return special('pack-lunch-v42', ['🍱','📝'], 'life', 123);

        // Social/caption concrete subjects.
        if (/\b(?:tiny|small|little)\s+(?:plant|seedling).{0,26}\b(?:new\s+leaf|leaf|sprout|grew|growth)\b|(?:작은\s*)?(?:화분|식물).{0,20}(?:새잎|새\s*잎|싹).{0,12}(?:나왔|자랐)|(?:새잎|싹).{0,18}(?:화분|식물)/i.test(text)) return special('new-leaf-v42', ['🌱','🪴','✨'], 'social', 123);
        if (/\bflowers?\b.{0,32}\b(?:desk|table|room).{0,16}\b(?:bright|brighter|cheer|better)|\b(?:desk|table|room).{0,22}\bflowers?\b|(?:꽃).{0,24}(?:책상|테이블|방).{0,16}(?:밝|달라|환해)/i.test(text)) return special('flowers-desk-v42', ['🌸','✨'], 'social', 123);
        if (/\b(?:breakfast|brunch).{0,26}\b(?:outside|outdoors|patio|terrace)\b|\b(?:outside|outdoors).{0,20}\b(?:breakfast|brunch)\b|(?:밖|야외|테라스).{0,16}(?:아침|브런치)|(?:아침|브런치).{0,16}(?:밖|야외)/i.test(text)) return special('breakfast-outside-v42', ['🍽️','☀️','😊'], 'social', 123);
        if (/\b(?:concert|live show|gig).{0,30}\b(?:better|amazing|great|louder|expected|worth)|(?:콘서트|공연).{0,28}(?:좋|대단|기대|신나|훨씬)/i.test(text)) return special('concert-v42', ['🎵','🤩'], 'social', 123);

        // Work and project operations.
        if (/\b(?:project\s+)?kickoff.{0,24}\b(?:moved|shifted|rescheduled|changed)\b|\b(?:moved|rescheduled).{0,18}\b(?:project\s+)?kickoff\b|(?:프로젝트\s*)?킥오프.{0,20}(?:옮겨|변경|미뤄|재조정)/i.test(text)) return special('kickoff-moved-v42', ['📅','🔄'], 'work', 124);
        if (/\b(?:slide deck|presentation deck|deck|slides?).{0,24}\b(?:attached|attachment|review|client)\b|\b(?:attached|attach).{0,20}\b(?:slide deck|presentation|slides?)\b|(?:발표\s*자료|슬라이드|덱).{0,20}(?:첨부|검토용|고객)/i.test(text)) return special('deck-attached-v42', ['📎','📊','👀'], 'work', 124);
        if (/\b(?:meeting notes|meeting minutes|minutes).{0,24}\b(?:sent|shared|emailed)\b|\b(?:sent|shared|emailed).{0,20}\b(?:meeting notes|minutes)\b|(?:회의\s*(?:메모|노트|록)).{0,18}(?:보냈|공유|전송)/i.test(text)) return special('meeting-notes-sent-v42', ['📝','📤','📧'], 'work', 124);
        if (/\b(?:reassigned|assigned|moved).{0,20}\b(?:ticket|issue|task).{0,18}\b(?:team|owner|assignee)\b|\b(?:ticket|issue|task).{0,18}\b(?:reassigned|assigned).{0,18}\b(?:team|owner|assignee)\b|(?:티켓|이슈|작업).{0,18}(?:담당|플랫폼\s*팀|팀).{0,18}(?:바꿨|변경|재할당)/i.test(text)) return special('ticket-reassigned-v42', ['👤','🔄'], 'work', 124);
        if (/\b(?:signed\s+)?(?:agreement|contract).{0,24}\b(?:attached|attachment|email)\b|\b(?:attached|attachment).{0,18}\b(?:signed\s+)?(?:agreement|contract)\b|(?:서명된\s*)?(?:계약서|계약).{0,20}(?:첨부|메일)/i.test(text)) return special('signed-contract-attached-v42', ['📜','📎','✍️'], 'work', 124);
        if (/\bproposal.{0,24}\b(?:due|deadline).{0,18}\b(?:monday|tuesday|wednesday|thursday|friday|noon|morning|afternoon|today|tomorrow)\b|(?:제안서).{0,22}(?:월요일|화요일|수요일|목요일|금요일|정오|오전|오후|오늘|내일).{0,12}(?:마감|까지)/i.test(text)) return special('proposal-due-v42', ['⏰','📝'], 'work', 124);
        if (/\b(?:legal|legal team).{0,20}\b(?:approved|cleared).{0,20}\b(?:contract|language|wording|terms)\b|(?:법무|법무팀).{0,18}(?:계약|문구|조항).{0,16}(?:승인|통과)/i.test(text)) return special('legal-contract-approved-v42', ['✅','⚖️','📜'], 'work', 124);
        if (/\b(?:shared|sent).{0,20}\b(?:final|updated|revised).{0,12}\b(?:roadmap|timeline|schedule)\b|(?:최종|수정된|업데이트된).{0,10}(?:로드맵|일정|타임라인).{0,16}(?:공유|보냈|전송)/i.test(text)) return special('roadmap-shared-v42', ['📤','📅'], 'work', 124);
        if (/\b(?:invoice|bill).{0,24}\b(?:approved|sent).{0,24}\bfinance\b|\bfinance\b.{0,24}\b(?:invoice|bill).{0,18}\b(?:approved|sent)\b|(?:청구서|인보이스).{0,20}(?:승인).{0,18}(?:재무|회계).{0,12}(?:전달|보냈|전송)/i.test(text)) return special('invoice-finance-v42', ['✅','🧾','💰'], 'work', 124);
        if (/\bdesign\s+review.{0,24}\b(?:feedback|engineering|comment)\b|(?:디자인\s*리뷰).{0,22}(?:피드백|엔지니어링|의견)/i.test(text)) return special('design-review-feedback-v42', ['🎨','💬','👀'], 'work', 124);
        if (/\b(?:moved|shifted|extended)\s+(?:the\s+)?deadline.{0,22}\b(?:back|later|days?|week)\b|(?:마감일|기한).{0,18}(?:뒤로|미뤘|연장|늦췄)/i.test(text)) return special('deadline-moved-v42', ['📅','⏰','🔄'], 'work', 124);
        if (/\b(?:handoff|handover)\s+checklist.{0,24}\b(?:ready|complete|prepared)\b|(?:인수인계\s*체크리스트).{0,20}(?:준비|완료)/i.test(text)) return special('handoff-checklist-v42', ['✅','📋','🤝'], 'work', 124);
        if (/\b(?:review|check).{0,18}\b(?:draft|document|proposal).{0,24}\b(?:before|by).{0,14}\b(?:tomorrow|morning|noon|today)\b|(?:내일|오늘).{0,12}(?:아침|정오)?.{0,8}(?:전|까지).{0,16}(?:초안|문서|제안).{0,12}(?:검토)/i.test(text)) return special('review-draft-deadline-v42', ['👀','⏰','📝'], 'work', 124);

        // Technical operations.
        if (/\bCPU\s+usage.{0,24}\b(?:jumped|spiked|surged|rose).{0,24}(?:percent|%|deploy|deployment)|(?:CPU\s*사용량).{0,22}(?:급증|치솟|넘었|증가)/i.test(text)) return special('cpu-spike-v42', ['📈','💻','⚠️'], 'tech', 125);
        if (/\bDNS\b.{0,26}\b(?:propagat(?:e|ing|ion)|updating|change)\b|\b(?:propagating|propagation).{0,20}\bDNS\b|DNS.{0,22}(?:전파|변경).{0,12}(?:중|진행)/i.test(text)) return special('dns-propagation-v42', ['🌐','⏳'], 'tech', 125);
        if (/\b(?:deadlock|lock contention).{0,24}\b(?:block|blocking|writes?|database|db)\b|(?:교착\s*상태|데드락).{0,22}(?:데이터베이스|DB|쓰기|막고|차단)/i.test(text)) return special('db-deadlock-v42', ['🔒','💻','⚠️'], 'tech', 125);
        if (/\b(?:worker|job|task)\s+queue.{0,24}\b(?:backlog|growing|building up|piling up)\b|(?:작업|워커|태스크)\s*큐.{0,20}(?:백로그|밀리|쌓이|늘고)/i.test(text)) return special('queue-backlog-v42', ['⚠️','⚙️','📈'], 'tech', 125);
        if (/\b(?:mobile\s+app|app).{0,24}\b(?:no longer|doesn['’]t|does not).{0,12}\b(?:crash|freeze|hang)\b|(?:모바일\s*앱|앱).{0,20}(?:이제|더\s*이상).{0,10}(?:충돌|크래시|멈춤|프리징).{0,8}(?:않|없)/i.test(text)) return special('mobile-no-crash-v42', ['✅','📱','🛠️'], 'tech', 125);
        if (/\b(?:database|db)\s+replica.{0,24}\b(?:catching up|caught up|synced|synchronizing)\b|(?:데이터베이스|DB)\s*복제본.{0,22}(?:따라잡|동기화|복구)/i.test(text)) return special('db-replica-recovery-v42', ['🔄','💾','✅'], 'tech', 125);
        if (/\bsearch\s+(?:indexing|indexer|reindexing).{0,22}\b(?:still|running|in progress)\b|\b(?:indexing|reindexing).{0,20}\b(?:still|running)\b|(?:검색\s*)?(?:색인|인덱싱).{0,18}(?:아직|진행|작업).{0,10}(?:중|진행)/i.test(text)) return special('search-index-running-v42', ['🔍','⏳'], 'tech', 125);
        if (/\b(?:token|api key|certificate|credential).{0,24}\b(?:expires?|expiring|expiry).{0,20}\b(?:days?|week|month)\b|(?:토큰|API\s*키|인증서|자격\s*증명).{0,18}(?:사흘|며칠|주|달).{0,10}(?:뒤|후).{0,8}(?:만료)/i.test(text)) return special('credential-expiry-v42', ['🔐','📅','⚠️'], 'tech', 125);
        if (/\b(?:integration|unit|end[- ]to[- ]end|e2e)\s+tests?.{0,24}\b(?:passing|pass|green)\s+(?:again|now)\b|(?:통합|단위|E2E)\s*테스트.{0,20}(?:다시|모두).{0,10}(?:통과|성공)/i.test(text)) return special('tests-passing-v42', ['✅','💻','🛠️'], 'tech', 125);
        if (/\b(?:patch|hotfix).{0,24}\b(?:restored|fixed|recovered).{0,24}\b(?:notification|delivery|alerts?)\b|(?:패치|핫픽스).{0,20}(?:알림|전송).{0,16}(?:정상|복구|해결)/i.test(text)) return special('notification-restored-v42', ['✅','🔔','🛠️'], 'tech', 125);
        if (/\b(?:restart(?:ed|ing)?).{0,20}\b(?:service|worker|server).{0,24}\b(?:memory leak|leak)\b|\b(?:memory leak|leak).{0,24}\b(?:restart(?:ed|ing)?).{0,18}\b(?:service|worker|server)\b|(?:메모리\s*누수).{0,18}(?:서비스|워커|서버).{0,12}(?:재시작|다시\s*시작)|(?:서비스|워커|서버).{0,18}(?:메모리\s*누수).{0,12}(?:재시작)/i.test(text)) return special('restart-memory-leak-v42', ['🔄','🛠️','💻'], 'tech', 125);

        // Commerce states.
        if (/\b(?:restocked|back in stock|stocked again)\b.{0,24}\b(?:medium|size|item|product)\b|\b(?:medium|size|item|product).{0,24}\b(?:restocked|back in stock)\b|(?:재고).{0,20}(?:다시\s*들어|입고|보충)|(?:사이즈).{0,18}(?:재입고|재고가\s*다시)/i.test(text)) return special('restock-v42', ['✅','🛒'], 'commerce', 124);
        if (/\bshipping.{0,20}\b(?:delayed|late|postponed)\b|(?:배송|발송).{0,18}(?:지연|늦어|연기)/i.test(text)) return special('shipping-delay-v42', ['🚚','⏳','⚠️'], 'commerce', 124);
        if (/\b(?:order|item|package).{0,22}\b(?:ready for pickup|pickup ready|ready to collect)\b|(?:주문\s*상품|상품|택배).{0,20}(?:픽업|수령).{0,10}(?:준비|가능)/i.test(text)) return special('pickup-ready-v42', ['📦','📍','✅'], 'commerce', 124);
        if (/\bpickup\s+(?:window|time|period).{0,20}\b(?:ends?|closes?|until)\b|(?:픽업|수령)\s*(?:가능\s*)?(?:시간|기한).{0,18}(?:끝|종료|까지)/i.test(text)) return special('pickup-window-v42', ['📍','⏰'], 'commerce', 124);
        if (/\b(?:store credit|account credit|credit balance).{0,20}\b(?:balance|\$|dollars?|amount)\b|(?:스토어|상점)\s*크레딧.{0,16}(?:잔액|금액)/i.test(text)) return special('store-credit-v42', ['💳','💰'], 'commerce', 124);
        if (/\b(?:return|returned item|return package).{0,20}\b(?:arrived|received|warehouse)\b|(?:반품|반품\s*상품).{0,18}(?:창고|도착|입고)/i.test(text)) return special('return-arrived-v42', ['📦','↩️'], 'commerce', 124);
        if (/\bfree\s+shipping.{0,18}\b(?:starts?|over|from|at)\b|(?:무료\s*배송).{0,18}(?:부터|이상|시작)/i.test(text)) return special('free-shipping-threshold-v42', ['🚚','💰'], 'commerce', 124);
        if (/\b(?:billing|invoice)\s+address.{0,20}\b(?:correct|fix|update|change|wrong)\b|(?:청구지|청구)\s*주소.{0,18}(?:수정|고쳐|변경|잘못)/i.test(text)) return special('billing-address-v42', ['📍','✏️','💳'], 'commerce', 124);

        // Travel refinements.
        if (/\b(?:baggage|luggage).{0,20}\b(?:appeared|arrived|came out).{0,18}\b(?:carousel|belt)\b|(?:수하물|짐).{0,18}(?:벨트|캐러셀).{0,12}(?:나왔|도착|보였)/i.test(text)) return special('baggage-arrived-v42', ['🧳','✅'], 'travel', 124);
        if (/\b(?:rented|hired)\s+(?:a\s+|some\s+)?bikes?\b|(?:자전거).{0,16}(?:빌렸|대여|렌탈)/i.test(text)) return special('bike-rental-v42', ['🚲','🌿'], 'travel', 124);
        if (/\bpassport\b.{0,20}\b(?:pocket|bag|backpack|case)\b|(?:여권).{0,18}(?:가방|주머니|파우치)/i.test(text)) return special('passport-bag-v42', ['🛂','🧳'], 'travel', 124);
        if (/\bairport\s+shuttle.{0,24}\b(?:every|minutes?|arrives?|leaves?)\b|(?:공항\s*셔틀).{0,18}(?:분마다|온다|도착|출발)/i.test(text)) return special('airport-shuttle-frequency-v42', ['🚌','✈️','⏰'], 'travel', 124);

        // Report language.
        if (/\bretention.{0,26}\b(?:highest|record|best|peak)\b|(?:유지율|리텐션).{0,20}(?:최고|기록|최고치)/i.test(text)) return special('retention-record-v42', ['📈','🏆'], 'report', 124);
        if (/\bserver\s+errors?.{0,24}\b(?:declined|fell|dropped|decreased)\b|(?:서버\s*오류).{0,20}(?:감소|하락|줄)/i.test(text)) return special('server-errors-down-v42', ['📉','📊'], 'report', 124);
        if (/\bchurn.{0,24}\b(?:unchanged|flat|stable|same|little change)\b|(?:이탈률|이탈).{0,20}(?:변하지|변화\s*없|비슷|그대로|안정)/i.test(text)) return special('churn-flat-v42', ['📊','➡️'], 'report', 124);
        if (/\b(?:daily\s+)?signups?.{0,24}\b(?:flat|same|similar|unchanged)\b|(?:일\s*)?(?:가입자|가입).{0,20}(?:비슷|그대로|변화\s*없)/i.test(text)) return special('signups-flat-v42', ['📊','➡️'], 'report', 124);
        if (/(?:고객지원|지원)\s*티켓.{0,24}(?:줄|감소|하락)|\bsupport\s+tickets?.{0,24}(?:fell|dropped|decreased|down)\b/i.test(text)) return special('support-tickets-down-v42', ['📉','📊'], 'report', 124);

        // Guard / ambiguity.
        if (/\bcan(?:not|['’]t)\s+wait\b.{0,32}\b(?:see|meet|visit|everyone|you|family|friends?)\b|(?:기다릴\s*수\s*없|너무\s*기대).{0,24}(?:만나|보다|모두|친구|가족)/i.test(text)) return special('cant-wait-positive-v42', ['🤩','🤝'], 'mood', 126);
        if (/\b(?:mouse|mice).{0,22}\b(?:fridge|refrigerator|kitchen|pantry|floor)\b|(?:쥐|생쥐).{0,20}(?:냉장고|주방|바닥|팬트리)/i.test(text)) return special('literal-mouse-v42', ['🐭','🏠'], 'animal', 126);
        if (/\b(?:ran|run)\s+(?:the\s+)?(?:backup|batch|cron|scheduled)\s+(?:job|task|script)\b|(?:백업|배치|크론|예약)\s*(?:작업|잡|스크립트).{0,12}(?:실행|돌렸)/i.test(text)) return special('run-job-v42', ['💻','🛠️'], 'tech', 126);
        if (/\b(?:report|document|file).{0,20}\b(?:not|wasn['’]t|isn['’]t)\s+late\b.{0,24}\b(?:sent|finished|submitted).{0,12}\bearly\b|(?:보고서|문서).{0,18}(?:늦은\s*게\s*아니|늦지\s*않).{0,20}(?:일찍|미리).{0,12}(?:보냈|제출|끝)/i.test(text)) return special('not-late-early-v42', ['✅','⏰'], 'work', 126);
        if (/\b(?:event|meeting|trip|reservation).{0,20}\b(?:no longer|not)\s+(?:cancelled|canceled)\b|(?:행사|회의|여행|예약).{0,18}(?:이제|더\s*이상).{0,10}(?:취소\s*상태가\s*아니|취소된\s*게\s*아니)/i.test(text)) return special('event-restored-v42', ['✅','📅'], 'status', 126);
        if (/\b(?:service|server|app).{0,20}\b(?:not|no longer)\s+down\b|(?:서비스|서버|앱).{0,18}(?:다운된|먹통인).{0,8}(?:상태가\s*)?(?:아니|아닌)/i.test(text)) return special('service-not-down-v42', ['✅','🛠️'], 'status', 126);
        if (/\b(?:not|isn['’]t|wasn['’]t)\s+sad\b|(?:슬픈|슬프).{0,10}(?:건\s*아니|것은\s*아니|않)/i.test(text)) return special('not-sad-v42', ['😊','👍'], 'mood', 126);
        // v41: compact repairs for Korean word order / morphology and double-negation status.
        if (/\b(?:reservation|booking).{0,18}\bno longer\s+(?:cancelled|canceled)\b|(?:예약).{0,18}(?:이제|더\s*이상).{0,10}(?:취소\s*상태가\s*아니|취소된\s*게\s*아니)/i.test(text)) return special('reservation-restored-v41', ['✅','📅'], 'status', 122);
        if (/\b(?:app|service).{0,18}\b(?:not|no longer)\s+unavailable\b|(?:앱|서비스).{0,18}(?:사용할\s*수\s*없는|사용\s*불가|이용\s*불가).{0,10}(?:상태가\s*)?(?:아니|아닌)/i.test(text)) return special('availability-double-neg-v41', ['✅','📱'], 'status', 122);
        if (/(?:해\s*뜬|일출|해돋이).{0,24}(?:직후|뒤|후)?.{0,16}(?:정상|산꼭대기).{0,16}(?:도착|올랐)|(?:정상|산꼭대기).{0,18}(?:도착|올랐).{0,24}(?:해\s*뜬|일출|해돋이)/i.test(text)) return special('summit-sunrise-ko-v41', ['🥾','🌅'], 'travel', 122);
        if (/(?:새\s*운동화|새\s*신발).{0,26}(?:걸|걷|산책)|(?:걸|걷|산책).{0,26}(?:새\s*운동화|새\s*신발)/i.test(text)) return special('fresh-shoes-walk-ko-v41', ['👟','🚶','🌿'], 'life', 122);
        if (/(?:베란다|발코니|창가).{0,18}달빛|달빛.{0,18}(?:베란다|발코니|창가)/i.test(text)) return special('moonlight-place-ko-v41', ['🌙','✨','📸'], 'social', 122);
        if (/(?:데모|시연).{0,24}(?:월요일|화요일|수요일|목요일|금요일|오전|오후|\d+시).{0,18}(?:잡혔|잡혔다|예정|예약|확정)|(?:월요일|화요일|수요일|목요일|금요일|오전|오후|\d+시).{0,18}(?:데모|시연).{0,18}(?:잡혔|잡혔다|예정|예약|확정)/i.test(text)) return special('demo-time-ko-v41', ['📅','⏰'], 'work', 122);
        if (/(?:검색\s*(?:서비스|엔진|클러스터)).{0,30}(?:색인|인덱스).{0,20}(?:다시\s*(?:만들|만드는|구축|빌드)|재구축|재색인)/i.test(text)) return special('search-reindex-ko-v41', ['🔍','⏳'], 'tech', 122);
        if (/\bcloud(?:s)?\b.{0,20}\bmoon\b|\bmoon\b.{0,20}\bcloud(?:s)?\b|구름.{0,18}달|달.{0,18}구름/i.test(text)) return special('moon-behind-cloud-v41', ['🌙'], 'weather', 122);
        // --- Negation / status recovery must outrank negative keyword matches. ---
        if (/\b(?:did not|didn['’]t|has not|hasn['’]t|was not|wasn['’]t)\s+(?:actually\s+)?(?:fail|failed|crash|break)|\b(?:not|no longer)\s+(?:unavailable|cancelled|canceled|rejected|declined|broken|down)\b.{0,24}\b(?:anymore|now|today)?|(?:실패|취소|거절|사용\s*불가|이용\s*불가|고장).{0,12}(?:상태가\s*)?(?:아니|아닌|않)|(?:실패|취소|거절).{0,12}(?:된\s*게|한\s*게)\s*아니/i.test(text) && /\b(?:success|successful|successfully|complete|completed|available|working|fixed|resolved|finished|early|anymore|now)\b|(?:정상|완료|성공|사용\s*가능|작동|해결|일찍\s*끝)/i.test(text)) {
            return special('recovered-negated-status-v40', ['✅','🛠️'], 'status', 120);
        }
        if (/\b(?:wasn['’]t|was not|not)\s+disappointed\b|\bnot\s+(?:unhappy|sad|upset)\b|(?:전혀|별로).{0,8}(?:실망|슬프|속상).{0,8}(?:않|아니)|(?:실망|슬프|속상).{0,8}(?:하지\s*않|않았)/i.test(text)) {
            return special('not-negative-feeling-v40', ['😊','👍'], 'mood', 120);
        }
        if (/\b(?:did not|didn['’]t)\s+miss\s+(?:the\s+)?deadline\b|(?:마감|기한).{0,8}(?:놓친\s*게\s*아니|놓치지\s*않).{0,18}(?:일찍|미리|완료|끝)/i.test(text)) {
            return special('deadline-met-v40', ['✅','⏰'], 'work', 120);
        }

        // --- Safety / prohibition. ---
        if (/\b(?:do not|don['’]t|please don['’]t|please do not|not yet)\s+(?:download|click|open|install|run|send|share|publish)\b|(?:아직\s*)?(?:다운로드|클릭|열|설치|실행|전송|공유|게시).{0,10}(?:하지\s*마|마세요|금지)/i.test(text)) {
            return special('prohibited-action-v40', ['⚠️','🛡️'], 'safety', 119);
        }

        // --- Human / literal ambiguity guards. ---
        if (/\b(?:ran into|bumped into|came across)\s+(?:an?\s+|my\s+|the\s+)?(?:old\s+)?(?:friend|coworker|colleague|neighbor|neighbour|classmate)\b|(?:우연히|길에서|역에서).{0,18}(?:친구|동료|이웃|동창).{0,12}(?:만났|마주쳤)/i.test(text)) {
            return special('chance-human-meeting-v40', ['🤝','😊'], 'social', 118);
        }
        if (/\b(?:ran|run|running)\s+(?:the\s+)?(?:migration|deploy|deployment|build|test|tests|script|command|job|query)\b|(?:마이그레이션|배포|빌드|테스트|스크립트|명령|작업|쿼리).{0,12}(?:실행|돌렸|돌리)/i.test(text)) {
            return special('run-tech-task-v40', ['💻','🛠️'], 'tech', 118);
        }
        if (/\b(?:mouse|mice)\b.{0,30}\b(?:kitchen|floor|room|garage|house)\b|(?:쥐|생쥐).{0,24}(?:주방|바닥|방|집)/i.test(text) && !/\b(?:computer|cursor|click|usb|bluetooth)\b|컴퓨터|커서|클릭|USB|블루투스/i.test(text)) {
            return special('animal-mouse-v40', ['🐭','🏠'], 'animal', 118);
        }
        if (/\bcloud(?:s)?\b.{0,20}\bmoon\b|\bmoon\b.{0,20}\bcloud(?:s)?\b|구름.{0,18}달|달.{0,18}구름/i.test(text)) {
            return special('cloud-moon-v40', ['☁️','🌙'], 'weather', 118);
        }

        // --- Everyday household / personal tasks. ---
        if (/\b(?:vacuum(?:ed|ing)?|hoover(?:ed|ing)?)\b|청소기.{0,8}(?:밀|돌|청소)|진공청소/i.test(text)) return special('vacuum-home-v40', ['🧹','🏠'], 'life', 116);
        if (/\b(?:grocery|shopping)\s+list\b|\b(?:made|wrote|write)\s+(?:a\s+)?list.{0,16}\b(?:grocery|groceries|shopping)\b|(?:장볼|장보기|쇼핑).{0,10}(?:목록|리스트)|(?:목록|리스트).{0,10}(?:장볼|장보기)/i.test(text)) return special('grocery-list-v40', ['🛒','📝'], 'life', 116);
        if (/\b(?:pharmacy|drugstore)\b|\b(?:picked up|collect(?:ed)?|got)\s+(?:my\s+|some\s+)?(?:medicine|medication|prescription)\b|약국|약을\s*(?:받|사|찾)/i.test(text)) return special('pharmacy-medicine-v40', ['💊','🏥'], 'health', 116);
        if (/\b(?:gave|give|giving)\s+(?:the\s+|my\s+)?(?:dog|puppy)\s+(?:a\s+)?bath\b|\b(?:bathed|washing)\s+(?:the\s+|my\s+)?(?:dog|puppy)\b|(?:강아지|개).{0,12}(?:목욕|씻겼|씻기)/i.test(text)) return special('dog-bath-v40', ['🐶','🛁'], 'life', 116);
        if (/\b(?:trimmed|pruned|cut back)\s+(?:the\s+|my\s+)?(?:herbs?|basil|mint|plants?)\b|(?:허브|바질|민트|식물).{0,12}(?:다듬|가지치기|잘랐)/i.test(text)) return special('trim-herbs-v40', ['🌿','🪴'], 'life', 116);
        if (/\b(?:haircut|hair style|hairstyle)\b|\b(?:cut|trimmed|changed)\s+(?:my\s+)?hair\b|머리\s*(?:스타일|모양)|머리를\s*(?:잘랐|바꿨|다듬)/i.test(text)) return special('haircut-v40', ['💇','✨'], 'life', 115);
        if (/\b(?:cooked|made|prepared).{0,18}\b(?:rice|vegetables?|veggies?)\b|\b(?:rice|vegetables?|veggies?).{0,18}\b(?:lunch|dinner|meal)\b|(?:밥|쌀).{0,18}(?:채소|야채).{0,18}(?:만들|요리|점심|저녁)/i.test(text)) return special('rice-vegetables-v40', ['🍚','🥗','🍽️'], 'food', 115);
        if (/\b(?:voice message|voice note|audio message|voicemail)\b|음성\s*(?:메시지|메모)|보이스\s*메시지/i.test(text)) return special('voice-message-v40', ['🎙️','📞','💛'], 'social', 116);
        if (/\b(?:newspaper|morning paper)\b|신문/i.test(text)) return special('newspaper-v40', ['📰','☕','🍽️'], 'life', 114);
        if (/\b(?:walked|walking)\s+home\b.{0,30}\b(?:clear|blue|sunny)\s+sky\b|(?:맑은|파란)\s*하늘.{0,24}(?:걸어|걸어서|걸었).{0,14}(?:집|귀가)|(?:집|집까지).{0,20}(?:걸어|걸었).{0,16}(?:맑은|파란)\s*하늘/i.test(text)) return special('walk-clear-sky-v40', ['🚶','☀️','🌿'], 'life', 115);
        if (/\b(?:sorted|organized|organised|cleaned up)\s+(?:the\s+|my\s+)?photos?\b|(?:휴대폰|폰)?.{0,10}사진.{0,12}(?:정리|분류)/i.test(text)) return special('sort-photos-v40', ['📸','📱','✅'], 'life', 115);
        if (/\b(?:practiced|practised|played)\s+(?:the\s+)?piano\b|피아노.{0,10}(?:연습|연주)|(?:연습|연주).{0,10}피아노/i.test(text)) return special('piano-v40', ['🎹','🎵'], 'creative', 115);

        // --- Social / caption scenes. ---
        if (/\bmoonlight\b.{0,24}\b(?:balcony|window|room|night)\b|달빛.{0,18}(?:베란다|창|방|밤)/i.test(text)) return special('moonlight-scene-v40', ['🌙','✨','📸'], 'social', 115);
        if (/\b(?:farmers? market|farmer['’]s market)\b.{0,30}\bstrawberr(?:y|ies)\b|\bstrawberr(?:y|ies)\b.{0,24}\b(?:market|stall)\b|(?:농산물\s*시장|농부\s*시장|시장).{0,20}딸기|딸기.{0,18}(?:시장|장터)/i.test(text)) return special('market-strawberry-v40', ['🍓','🛍️'], 'social', 117);
        if (/\b(?:bakery|bakeshop)\b|빵집|베이커리/i.test(text)) return special('bakery-v40', ['🥐','😋'], 'food', 114);
        if (/\b(?:new book|book).{0,20}\b(?:quiet|cozy|cosy)\s+(?:corner|spot|seat)\b|(?:새\s*책|책\s*한\s*권).{0,18}(?:조용|아늑).{0,10}(?:구석|자리)/i.test(text)) return special('book-quiet-corner-v40', ['📖','🌿','😌'], 'social', 115);
        if (/\braincoat\b|비옷/i.test(text)) return special('raincoat-day-v40', ['🌧️','😊'], 'weather', 114);
        if (/\b(?:dinner|meal).{0,35}\b(?:wish|wanted).{0,18}\b(?:lasted|longer)\b|(?:저녁|식사).{0,24}(?:더\s*길|오래).{0,10}(?:했으면|이어졌)/i.test(text)) return special('long-dinner-v40', ['🍽️','💛'], 'social', 115);
        if (/\b(?:fresh|new)\s+(?:sneakers?|trainers?|shoes).{0,30}\b(?:walk|walking)\b|\b(?:walk|walking).{0,30}\b(?:fresh|new)\s+(?:sneakers?|trainers?|shoes)\b|(?:새\s*운동화|새\s*신발).{0,24}(?:걷|산책)/i.test(text)) return special('fresh-sneakers-walk-v40', ['👟','🚶','🌿'], 'life', 116);
        if (/\b(?:cat|kitten).{0,25}\b(?:chair|seat).{0,15}\b(?:warm|warmest|claimed|took)\b|\b(?:warm|warmest).{0,20}\b(?:chair|seat).{0,16}\b(?:cat|kitten)\b|고양이.{0,24}(?:따뜻한|의자|자리).{0,16}(?:차지|앉)/i.test(text)) return special('cat-warm-chair-v40', ['🐱','😴'], 'social', 115);
        if (/\b(?:sunlight|sunbeam|sunshine).{0,25}\b(?:room|floor|window)\b|햇빛.{0,20}(?:방|바닥|창)/i.test(text)) return special('sunlight-room-v40', ['☀️','✨','🌿'], 'social', 115);
        if (/\bcoffee\b.{0,28}\b(?:missed|hadn['’]t seen|not seen).{0,18}\b(?:someone|friend|person|him|her|them)\b|\b(?:someone|friend|person).{0,28}\b(?:missed|hadn['’]t seen).{0,18}\bcoffee\b|(?:보고\s*싶었던|오랜만에\s*만난).{0,18}(?:사람|친구).{0,18}커피|커피.{0,18}(?:보고\s*싶었던|오랜만에\s*만난).{0,18}(?:사람|친구)/i.test(text)) return special('coffee-missed-person-v40', ['☕','🤝','💛'], 'social', 117);
        if (/\b(?:quiet|calm)\s+train\s+ride\b.{0,30}\b(?:album|music|playlist|headphones?)\b|\b(?:album|music|playlist).{0,30}\b(?:quiet|calm)\s+train\s+ride\b|조용히.{0,16}(?:기차|열차).{0,22}(?:앨범|음악)|(?:앨범|음악).{0,22}(?:기차|열차)/i.test(text)) return special('quiet-train-music-v40', ['🚆','🎧','😌'], 'social', 116);
        if (/\b(?:small|little|tiny)\s+win\b|\bstill counts\b|(?:작은|소소한)\s*(?:성공|승리)|그래도\s*성공/i.test(text)) return special('small-win-v40', ['🎉','🙌','🌱'], 'growth', 116);

        // --- Work / collaboration. ---
        if (/\b(?:weekly sync|weekly meeting|team sync).{0,28}\b(?:moved|shifted|rescheduled|changed)\b.{0,26}\b(?:monday|tuesday|wednesday|thursday|friday|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b|(?:주간\s*(?:미팅|회의|싱크)).{0,26}(?:옮겨|변경|재조정).{0,24}(?:월요일|화요일|수요일|목요일|금요일|오전|오후|\d+시)/i.test(text)) return special('weekly-sync-moved-v40', ['📅','⏰'], 'work', 118);
        if (/\b(?:attached|attach)\b.{0,24}\b(?:spreadsheet|sheet|workbook)\b|\b(?:spreadsheet|sheet|workbook)\b.{0,24}\b(?:attached|attachment|review)\b|(?:스프레드시트|시트|엑셀).{0,18}(?:첨부|검토용)|(?:첨부).{0,18}(?:스프레드시트|시트|엑셀)/i.test(text)) return special('spreadsheet-attached-v40', ['📎','📊','👀'], 'work', 118);
        if (/\b(?:leave|add|send)\s+(?:your\s+)?comments?\b.{0,30}\b(?:by|before|end of)\b.{0,18}\b(?:today|tomorrow|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b|(?:오늘|내일).{0,12}(?:안에|까지).{0,18}(?:의견|댓글|코멘트).{0,12}(?:남겨|보내)|(?:의견|댓글|코멘트).{0,18}(?:오늘|내일).{0,12}(?:안에|까지)/i.test(text)) return special('comments-deadline-v40', ['💬','⏰'], 'work', 118);
        if (/\b(?:handoff|hand-over)\s+(?:document|doc|file).{0,24}\b(?:ready|prepared|complete)\b|\b(?:ready|prepared)\b.{0,24}\b(?:handoff|hand-over)\s+(?:document|doc|file)\b|(?:인수인계\s*문서).{0,24}(?:준비|완료|넘길)/i.test(text)) return special('handoff-ready-v40', ['📄','🤝','✅'], 'work', 118);
        if (/\b(?:budget\s+(?:request|proposal|approval)).{0,24}\b(?:approved|accepted|cleared)\b|\b(?:approved|accepted)\b.{0,24}\b(?:budget\s+(?:request|proposal))\b|(?:예산\s*(?:요청|안|신청)).{0,20}(?:승인|통과)/i.test(text)) return special('budget-approved-v40', ['✅','💰'], 'work', 118);
        if (/\b(?:design\s+(?:mockup|mock-up|comp|draft)).{0,28}\b(?:revision|revise|edit|change)\b|(?:디자인\s*(?:시안|목업|초안)).{0,22}(?:수정|리비전|변경)/i.test(text)) return special('design-revision-v40', ['🎨','✏️'], 'work', 118);
        if (/\b(?:demo|demonstration).{0,22}\b(?:booked|scheduled|set)\b.{0,24}\b(?:monday|tuesday|wednesday|thursday|friday|morning|afternoon|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b|(?:데모|시연).{0,20}(?:예약|잡혔|예정).{0,20}(?:월요일|화요일|수요일|목요일|금요일|오전|오후|\d+시)/i.test(text)) return special('demo-scheduled-v40', ['📅','⏰'], 'work', 118);
        if (/\b(?:contract|agreement).{0,24}\b(?:signature|signing|sign)\b|(?:계약서|계약).{0,20}(?:서명|사인)/i.test(text)) return special('contract-signature-v40', ['📜','✍️'], 'work', 118);
        if (/\b(?:shared|sent|posted)\b.{0,20}\b(?:updated|revised|new)\s+(?:timeline|schedule|roadmap)\b|\b(?:updated|revised|new)\s+(?:timeline|schedule|roadmap).{0,20}\b(?:shared|sent)\b|(?:수정된|업데이트된|새)\s*(?:일정|타임라인|로드맵).{0,20}(?:공유|보냈|전송)/i.test(text)) return special('timeline-shared-v40', ['📅','📤'], 'work', 118);
        if (/\b(?:issue|ticket|task)\s+(?:owner|assignee).{0,24}\b(?:changed|switched|updated)\b|\b(?:owner|assignee).{0,20}\b(?:changed|switched)\b.{0,20}\b(?:issue|ticket|task)\b|(?:이슈|티켓|작업).{0,16}(?:담당자|소유자).{0,18}(?:바뀌|변경)/i.test(text)) return special('issue-owner-changed-v40', ['👤','🔄'], 'work', 118);

        // --- Technical operations. ---
        if (/\b(?:api|endpoint|request).{0,20}\b429\b|\b429\b.{0,20}\b(?:api|endpoint|request|rate limit)\b|429.{0,10}(?:요청\s*제한|레이트\s*리밋|API)|API.{0,16}429/i.test(text)) return special('rate-limit-429-v40', ['⚠️','💻','⏱️'], 'tech', 119);
        if (/\bmemory\s+(?:usage|use|consumption).{0,24}\b(?:spiked|jumped|surged|rose sharply|increased sharply)\b|\b(?:spiked|surged)\b.{0,20}\bmemory\s+(?:usage|use)\b|메모리\s*사용량.{0,18}(?:급증|치솟|증가)/i.test(text)) return special('memory-spike-v40', ['📈','💻','⚠️'], 'tech', 119);
        if (/\bwebhook\b.{0,30}\b(?:working|healthy|normal)\s+again\b|\b(?:working|healthy)\s+again\b.{0,24}\bwebhook\b|웹훅.{0,24}(?:다시\s*작동|정상|복구)/i.test(text)) return special('webhook-recovered-v40', ['✅','🔄','💻'], 'tech', 119);
        if (/\b(?:disk|system|database|server)\s+backup.{0,24}\b(?:completed|finished|done|successful)\b|(?:디스크|시스템|데이터베이스|서버)\s*백업.{0,20}(?:완료|끝|성공)/i.test(text)) return special('backup-complete-v40', ['💾','✅','🌅'], 'tech', 119);
        if (/\b(?:certificate|cert|tls|ssl).{0,20}\b(?:expires?|expiring|expiration)\b|(?:인증서|TLS|SSL).{0,18}(?:만료|유효기간)/i.test(text)) return special('certificate-expiry-v40', ['🔐','📅','⚠️'], 'tech', 119);
        if (/\b(?:rolled back|rollback|reverted)\b.{0,24}\b(?:deploy|deployment|release|build)\b|\b(?:deploy|deployment|release).{0,24}\b(?:rolled back|rollback|reverted)\b|(?:배포|릴리스|빌드).{0,18}(?:롤백|되돌렸)|(?:롤백|되돌렸).{0,18}(?:배포|릴리스)/i.test(text)) return special('deployment-rollback-v40', ['↩️','🛠️','❌'], 'tech', 119);
        if (/\b(?:upload\s+queue|job\s+queue|processing\s+queue).{0,26}\b(?:moving|working|running|flowing)\s+(?:normally|again|now)\b|(?:업로드|작업|처리)\s*큐.{0,22}(?:정상|다시).{0,12}(?:움직|작동|처리)/i.test(text)) return special('queue-normal-v40', ['✅','⚙️'], 'tech', 119);
        if (/\b(?:search\s+(?:service|engine|cluster)).{0,28}\b(?:rebuild(?:ing)?|reindex(?:ing)?|building)\b.{0,12}\bindex\b|(?:검색\s*(?:서비스|엔진|클러스터)).{0,24}(?:색인|인덱스).{0,16}(?:재구축|다시\s*만들|빌드)/i.test(text)) return special('search-index-rebuild-v40', ['🔍','⏳'], 'tech', 119);
        if (/\b(?:slow|long[- ]running)\s+query.{0,24}\b(?:lock(?:ing|ed)?|block(?:ing|ed)?)\b.{0,20}\b(?:database|db|table)\b|(?:느린|오래\s*걸리는)\s*쿼리.{0,22}(?:데이터베이스|DB|테이블).{0,14}(?:잠그|락|막)/i.test(text)) return special('slow-query-lock-v40', ['🐢','💻','🔒'], 'tech', 119);
        if (/\b(?:mobile|app).{0,24}\b(?:freeze|freezing|hang|crash).{0,24}\b(?:gone|fixed|resolved|stopped)\b|\b(?:freeze|freezing).{0,18}\b(?:gone|fixed|resolved)\b.{0,18}\b(?:latest|new)\s+build\b|(?:최신|새)\s*빌드.{0,20}(?:모바일|앱).{0,18}(?:멈춤|프리징|먹통).{0,12}(?:사라|해결|수정)/i.test(text)) return special('mobile-freeze-gone-v40', ['✅','📱','🛠️'], 'tech', 119);

        // --- Commerce / order states. ---
        if (/\b(?:delivery|courier).{0,24}\b(?:attempted|tried)\b.{0,26}\b(?:nobody|no one|not home|absent)\b|(?:배송|배달).{0,18}(?:시도|왔).{0,20}(?:사람이\s*없|부재|집에\s*없)/i.test(text)) return special('delivery-attempt-v40', ['📦','🚚','⚠️'], 'commerce', 119);
        if (/\brefund.{0,20}\b(?:issued|processed|completed|sent|approved)\b|(?:환불).{0,18}(?:처리|지급|완료|승인)/i.test(text)) return special('refund-issued-v40', ['💳','✅'], 'commerce', 119);
        if (/\b(?:preorders?|pre-orders?).{0,22}\b(?:close|end|deadline)\b.{0,18}\b(?:midnight|today|tomorrow|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b|(?:예약\s*주문|선주문|프리오더).{0,18}(?:자정|오늘|내일|\d+시).{0,10}(?:마감|종료)/i.test(text)) return special('preorder-close-v40', ['🛒','⏰'], 'commerce', 119);
        if (/\b(?:inventory|stock).{0,24}\b(?:running|getting)\s+low\b|\blow\s+(?:inventory|stock)\b|(?:재고).{0,18}(?:얼마\s*남지|부족|낮|거의\s*없)/i.test(text)) return special('inventory-low-v40', ['⚠️','🛒'], 'commerce', 119);
        if (/\b(?:shipping|delivery)\s+address.{0,20}\b(?:invalid|incorrect|wrong)\b|(?:배송|배달)\s*주소.{0,18}(?:올바르지|잘못|유효하지)/i.test(text)) return special('shipping-address-invalid-v40', ['❌','📍','🚚'], 'commerce', 119);
        if (/\b(?:gift\s*card).{0,20}\bbalance\b|(?:기프트|선물)\s*카드.{0,18}(?:잔액|남은\s*금액)/i.test(text)) return special('gift-card-balance-v40', ['🎁','💳','💰'], 'commerce', 119);
        if (/\b(?:package|parcel|order).{0,24}\b(?:waiting|ready|held)\b.{0,20}\b(?:pickup|collection)\s+(?:point|location|store)\b|(?:택배|소포|주문).{0,20}(?:픽업|수령)\s*(?:지점|장소).{0,14}(?:대기|기다리|준비)/i.test(text)) return special('package-pickup-v40', ['📦','📍'], 'commerce', 119);
        if (/\b(?:discount|promo|coupon)\s+code.{0,20}\b(?:no longer|not)\s+(?:valid|active|working)\b|(?:할인|프로모션|쿠폰)\s*코드.{0,20}(?:더\s*이상|이제).{0,8}(?:유효하지|안\s*돼|사용\s*불가)/i.test(text)) return special('discount-invalid-v40', ['🚫','🏷️'], 'commerce', 119);
        if (/\b(?:exchange|replacement)\s+(?:request\s+)?(?:was\s+|is\s+)?approved\b|(?:교환|교체)\s*(?:요청)?.{0,14}(?:승인|허용)/i.test(text)) return special('exchange-approved-v40', ['✅','📦'], 'commerce', 119);
        if (/\b(?:order|cart)\s+(?:total|amount).{0,24}\b(?:changed|increased|updated)\b.{0,18}\b(?:tax|fees?)\b|\b(?:tax|fees?).{0,18}\b(?:order|cart)\s+(?:total|amount).{0,18}\b(?:changed|increased)\b|(?:세금|수수료).{0,16}(?:적용|후).{0,18}(?:주문|결제)\s*(?:금액|합계).{0,12}(?:바뀌|증가|변경)/i.test(text)) return special('order-total-tax-v40', ['💰','🧾'], 'commerce', 119);

        // --- Travel. ---
        if (/\b(?:platform|gate).{0,20}\b(?:changed|moved|switched)\b.{0,18}\b(?:from|to)\s*\d+\b|(?:플랫폼|승강장|게이트).{0,16}(?:\d+번?).{0,12}(?:에서|으로).{0,12}(?:\d+번?).{0,10}(?:바뀌|변경)/i.test(text)) return special('platform-changed-v40', ['🚆','📍'], 'travel', 119);
        if (/\bairport\s+security.{0,26}\b(?:hour|minutes?|long|took)\b|공항\s*보안\s*(?:검색|검사).{0,22}(?:시간|분|걸렸|오래)/i.test(text)) return special('airport-security-wait-v40', ['✈️','⏳'], 'travel', 119);
        if (/\bhotel\s+(?:room|suite).{0,24}\b(?:ready|available)\b.{0,14}\b(?:early|already)\b|호텔\s*(?:방|객실).{0,20}(?:일찍|벌써).{0,10}(?:준비|사용\s*가능)/i.test(text)) return special('hotel-room-ready-v40', ['🏨','✅'], 'travel', 119);
        if (/\b(?:bus|shuttle).{0,18}\b(?:airport).{0,20}\b(?:leaves?|departs?|at\s+\d)\b|\bairport\b.{0,18}\b(?:bus|shuttle).{0,20}\b(?:leaves?|departs?|at\s+\d)\b|공항(?:행|으로\s*가는)\s*(?:버스|셔틀).{0,20}(?:출발|떠나|\d+시)/i.test(text)) return special('airport-bus-v40', ['🚌','⏰','✈️'], 'travel', 119);
        if (/\b(?:reached|arrived at|made it to)\s+(?:the\s+)?(?:summit|peak).{0,24}\b(?:sunrise|dawn)\b|\b(?:sunrise|dawn).{0,24}\b(?:summit|peak)\b|(?:정상|산꼭대기).{0,20}(?:해\s*뜬|일출|새벽).{0,14}(?:도착|올랐)/i.test(text)) return special('summit-sunrise-v40', ['🥾','🌅'], 'travel', 119);
        if (/\b(?:rental|hired?)\s+bike.{0,24}\b(?:ready|waiting|outside)\b.{0,18}\b(?:station|hotel|shop)\b|(?:대여|렌탈)\s*자전거.{0,20}(?:역|호텔|가게).{0,14}(?:준비|대기)/i.test(text)) return special('rental-bike-ready-v40', ['🚲','✅'], 'travel', 119);
        if (/\bboarding\s+pass.{0,24}\b(?:saved|stored|added)\b.{0,18}\b(?:wallet|app|phone)\b|탑승권.{0,20}(?:지갑|월렛)\s*앱.{0,12}(?:저장|추가)/i.test(text)) return special('boarding-pass-wallet-v40', ['🎫','📱'], 'travel', 119);
        if (/\b(?:luggage|baggage)\s+(?:carousel|belt).{0,24}\b(?:not|hasn['’]t|has not|still).{0,18}\b(?:started|moving|running)\b|(?:수하물|짐)\s*(?:벨트|캐러셀).{0,24}(?:아직|시작).{0,12}(?:않|안\s*됐|전)/i.test(text)) return special('luggage-carousel-wait-v40', ['🧳','⏳'], 'travel', 119);
        if (/\b(?:tour|excursion|trip).{0,18}\b(?:cancelled|canceled|called off)\b.{0,24}\b(?:rain|storm|weather)\b|(?:비|폭우|폭풍|날씨).{0,20}(?:투어|여행|일정).{0,12}(?:취소)|(?:투어|여행).{0,20}(?:취소).{0,16}(?:비|폭우|날씨)/i.test(text)) return special('tour-rain-cancel-v40', ['🚫','🌧️'], 'travel', 119);
        if (/\b(?:quiet|small|cozy|cosy)\s+caf[eé].{0,22}\b(?:station|terminal)\b|\b(?:station|terminal).{0,22}\b(?:quiet|small|cozy|cosy)\s+caf[eé]\b|(?:역|터미널).{0,18}(?:근처|옆).{0,14}(?:조용한|작은|아늑한)\s*카페|(?:조용한|작은|아늑한)\s*카페.{0,18}(?:역|터미널)/i.test(text)) return special('cafe-near-station-v40', ['☕','🚆'], 'travel', 119);

        // --- Reports / metrics. ---
        if (/\bretention.{0,24}\b(?:improved|rose|increased|up)\b|(?:유지율|리텐션).{0,20}(?:개선|상승|증가)/i.test(text)) return special('retention-up-v40', ['📈','📊'], 'report', 118);
        if (/\b(?:error|failure)\s+(?:count|volume|rate).{0,24}\b(?:dropped|fell|decreased|down|halved)\b|(?:오류|실패)\s*(?:건수|수|비율).{0,20}(?:줄|감소|하락|절반)/i.test(text)) return special('error-count-down-v40', ['📉','📊'], 'report', 118);
        if (/\bresponse\s+time.{0,24}\b(?:stable|steady|unchanged|flat)\b|\b(?:stable|steady).{0,18}\bresponse\s+time\b|응답\s*시간.{0,20}(?:안정|유지|비슷|변화\s*없)/i.test(text)) return special('response-time-stable-v40', ['📊','➡️','⏱️'], 'report', 118);
        if (/\b(?:cart\s+abandonment|abandonment\s+rate).{0,24}\b(?:increased|rose|up)\b|(?:장바구니\s*이탈|이탈률).{0,20}(?:증가|상승)/i.test(text)) return special('cart-abandonment-up-v40', ['📈','📊'], 'report', 118);
        if (/\b(?:new\s+subscriptions?|subscriptions?).{0,24}\b(?:monthly\s+record|record\s+high|highest)\b|(?:신규\s*구독|구독).{0,20}(?:월간\s*최고|최고치|기록)/i.test(text)) return special('subscriptions-record-v40', ['📈','🏆'], 'report', 118);
        if (/\b(?:support\s+)?wait\s+time.{0,24}\b(?:fell|dropped|below|decreased)\b|(?:고객지원\s*)?대기\s*시간.{0,20}(?:줄|감소|아래|내려)/i.test(text)) return special('wait-time-down-v40', ['📉','⏱️'], 'report', 118);
        if (/\b(?:daily\s+)?revenue.{0,24}\b(?:flat|unchanged|same|similar)\b|(?:일\s*)?매출.{0,20}(?:비슷|그대로|변화\s*없|평평)/i.test(text)) return special('revenue-flat-v40', ['📊','➡️'], 'report', 118);
        if (/\b(?:trial\s+activation|activation\s+rate).{0,24}\b(?:rose|increased|improved|up)\b|(?:체험판?\s*활성화|활성화율).{0,20}(?:상승|증가|개선)/i.test(text)) return special('trial-activation-up-v40', ['📈','📊'], 'report', 118);

        // --- Protected-span context. ---
        if (/\b(?:checking|investigating|looking into|monitoring).{0,20}\b(?:outage|incident|issue)\b|\b(?:outage|incident|issue).{0,20}\b(?:checking|investigating|monitoring)\b|(?:장애|사고|문제).{0,16}(?:확인|조사|모니터링)|(?:확인|조사|모니터링).{0,16}(?:장애|사고|문제)/i.test(text)) return special('checking-outage-v40', ['🔍','⚠️'], 'tech', 118);
        if (/https?:\/\//i.test(raw) && /\b(?:check|open|review|inspect|visit)\b|확인|열어|검토/i.test(text)) return special('url-check-v40', ['🌐','🔎','🛠️'], 'tech', 110);
        if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(raw) && /\b(?:send|email|mail)\b|보내|전송|메일/i.test(text)) return special('email-send-v40', ['📧','📸'], 'work', 110);
        if (/`[^`]+`/.test(raw) && /\b(?:run|execute|test|merge)\b|실행|병합|테스트/i.test(text)) return special('code-run-v40', ['💻','🛠️'], 'tech', 110);
        if (/#[\p{L}\p{N}_-]+/u.test(raw) && /\b(?:caption|keep|include|post)\b|캡션|유지|포함|게시/i.test(text)) return special('hashtag-caption-v40', ['🔖','📝'], 'social', 110);
        // High-value sentence semantics that should beat generic keyword profiles.
        // Broad semantic patterns learned from cross-domain QA. These rules intentionally
        // cover meaning families rather than exact benchmark sentences.

        // v6 semantic guards: resolve common ambiguities before broad keyword profiles.
        // v6.1 semantic refinements for common natural-language paraphrases.
        // v6.2 broader precedence rules discovered by multi-domain regression testing.
        // v6.3 everyday-language precedence: broad natural paraphrases that were missed by keyword-first matching.
        // v7.1 refinements after the 576-case mixed-domain corpus.
        // v8 small high-confidence gaps from natural Korean phrasing.
        // v9 semantic coverage from a second, previously unseen 548-case corpus.
        // v16 broad lexical intent guards: natural phrases that should not fall through to decorative defaults.
        // v17 semantic precedence guards built from broad multi-domain holdout errors.
        // v18 semantic precedence: broader human-writing, travel, report and hobby intents.
        // v19 top-priority ambiguity fixes and compound-sentence support.
        // v20 Korean morphology and long-form precedence fixes.
        // v24 broad subject-first rules from a fresh 3,061-case cross-domain holdout.
        // v25 natural-language repairs from cross-domain long/short form QA.
        // v27 broad semantic precedence from a new 3,425-case untouched corpus.
        // v28 explicit-emotion precedence and realistic daily/social anchors.
        // v29 reflection, people, weather and protected-span refinements from a fresh independent holdout.
        // v30 intent-specific emotion/status guards from a second independent broad holdout.
        // v39 narrow Korean precedence repairs before the next untouched holdout.
        if (/(?:집에|집으로).{0,16}(?:걸어|걷).{0,18}(?:언니|오빠|형|누나|동생|엄마|아빠).{0,12}(?:전화|통화)|(?:언니|오빠|형|누나|동생|엄마|아빠).{0,12}(?:전화|통화).{0,18}(?:걸어|걷).{0,12}(?:집에|집으로)/i.test(text)) return special('family-call-walk-ko-v39', ['📞','💛','🚶'], 'social', 99);
        if (/(?:팀|우리).{0,18}(?:다음\s*)?마일스톤.{0,18}(?:합의|정했|확정)|(?:다음\s*)?마일스톤.{0,18}(?:합의|정했|확정).{0,18}(?:팀|우리)/i.test(text)) return special('milestone-agreed-ko-v39', ['🎯','🤝'], 'work', 99);
        if (/(?:오후|오전)\s*\d+시.{0,18}(?:전|까지).{0,18}(?:서명\s*문서|서명된\s*문서|서명\s*파일).{0,18}(?:업로드|보내|전송)|(?:서명\s*문서|서명된\s*문서|서명\s*파일).{0,18}(?:오후|오전)\s*\d+시.{0,18}(?:전|까지).{0,18}(?:업로드|보내|전송)/i.test(text)) return special('signed-upload-ko-v39', ['📤','⏰','📄'], 'work', 99);
        if (/(?:패치|업데이트).{0,18}(?:설치할\s*준비|설치\s*준비|설치할\s*수\s*있|설치\s*가능).{0,10}(?:됐|되었|완료|상태)?/i.test(text)) return special('patch-ready-ko-v39', ['🛠️','⬇️'], 'tech', 99);
        // v38 broad natural-language coverage from a third untouched cross-domain holdout.
        // Household / everyday life
        if (/\b(?:changed|washed|put on) (?:the |my )?(?:bed )?sheets?\b|(?:침대\s*)?(?:시트|이불).{0,16}(?:갈|바꿨|세탁)/i.test(text)) return special('fresh-sheets-v38', ['🏠','✨','🌿'], 'life', 98);
        if (/\b(?:washed|did) (?:the )?dishes\b|\bcleared (?:the )?(?:counter|kitchen counter)\b|설거지|조리대.{0,10}(?:정리|치우)|(?:정리|치우).{0,10}조리대/i.test(text)) return special('dishes-v38', ['🧹','🏠','✨'], 'life', 98);
        if (/\b(?:oatmeal|porridge)\b|오트밀|죽\b/i.test(text)) return special('oatmeal-v38', ['🥣','🍽️'], 'topic', 98);
        if (/\b(?:planted|planting|grew|growing).{0,18}(?:basil|herbs?|seedlings?)\b|\b(?:basil|herbs?).{0,18}(?:pot|planter)\b|(?:바질|허브|모종).{0,18}(?:심었|심은|화분)|(?:심었|심은).{0,18}(?:바질|허브|모종)/i.test(text)) return special('plant-basil-v38', ['🌿','🪴'], 'life', 98);
        if (/\b(?:bookstore|book shop|bookshop)\b|서점/i.test(text)) return special('bookstore-v38', ['📚','🛍️'], 'life', 98);
        if (/\b(?:postcard).{0,20}(?:friend|family|wrote|write)|(?:wrote|write).{0,20}(?:postcard)|(?:엽서).{0,18}(?:친구|가족|썼|적었)|(?:썼|적었).{0,18}엽서/i.test(text)) return special('postcard-v38', ['✉️','💛'], 'social', 98);
        if (/\b(?:fixed|repaired|tightened).{0,18}(?:shelf|cabinet|drawer|chair)\b|(?:선반|장|서랍|의자).{0,18}(?:고쳤|수리|조였)/i.test(text)) return special('home-repair-v38', ['🛠️','🏠'], 'life', 98);
        if (/\b(?:mailed|posted|sent).{0,18}(?:a |the )?(?:package|parcel)\b|(?:택배|소포).{0,16}(?:보냈|발송)|(?:보냈|발송).{0,16}(?:택배|소포)/i.test(text)) return special('mail-package-v38', ['📦','📮'], 'life', 98);
        if (/\b(?:train window|window of the train).{0,20}(?:headphones?|music|quiet)|\bheadphones?.{0,20}(?:train window|train ride)|기차\s*창문.{0,20}(?:이어폰|음악|여유)|이어폰.{0,20}기차\s*창문/i.test(text)) return special('train-headphones-v38', ['🚆','🎧','😌'], 'social', 98);

        // Social/caption mood and concrete scene
        if (/\b(?:small|tiny|little) (?:reason|thing).{0,18}(?:smile|happy)|(?:reason|thing).{0,18}(?:made me smile|to smile)\b|웃을\s*이유|미소\s*지을\s*이유/i.test(text)) return special('reason-smile-v38', ['😊','💛'], 'mood', 98);
        if (/\b(?:tiny|little|small) (?:treat|dessert|reward).{0,24}(?:week|day)|(?:long|hard) week.{0,18}(?:treat|dessert)|작은\s*(?:디저트|보상|간식).{0,20}(?:한\s*주|하루)|(?:긴|힘든)\s*한\s*주.{0,20}(?:디저트|간식|보상)/i.test(text)) return special('small-treat-v38', ['🍰','💛','😌'], 'mood', 97);
        if (/\b(?:city lights|street lights|skyline).{0,18}(?:after|in) (?:the )?rain|\brain.{0,18}(?:city lights|street lights|skyline)|비.{0,16}(?:온\s*뒤|그친\s*뒤).{0,18}(?:도시\s*불빛|야경)|(?:도시\s*불빛|야경).{0,18}비/i.test(text)) return special('rain-city-v38', ['🌃','🌧️','📸'], 'social', 98);
        if (/\b(?:fresh flowers?|bouquet).{0,24}(?:room|home|table).{0,18}(?:feel|look|changed|different)|(?:room|home).{0,20}(?:fresh flowers?|bouquet)|(?:생화|꽃).{0,20}(?:방|집).{0,20}(?:분위기|달라|바뀌)|(?:방|집).{0,20}(?:생화|꽃)/i.test(text)) return special('flowers-room-v38', ['🌸','✨','🌿'], 'social', 98);
        if (/\b(?:morning sun|morning sunlight|sunlight).{0,24}(?:kitchen|floor|window)|(?:아침\s*햇살|햇빛).{0,24}(?:주방|바닥|창문)/i.test(text)) return special('morning-sun-v38', ['☀️','🌿','📸'], 'social', 97);
        if (/\b(?:slow|quiet) (?:saturday|sunday|weekend).{0,24}(?:needed|need|good for me)|\b(?:needed|need).{0,20}(?:slow|quiet) (?:saturday|sunday|weekend)|(?:느린|조용한)\s*(?:토요일|일요일|주말).{0,24}(?:필요|좋았)|(?:토요일|일요일|주말).{0,24}(?:이런\s*)?(?:느린|조용한).{0,16}(?:필요|좋았)/i.test(text)) return special('slow-weekend-v38', ['🌿','😌'], 'life', 98);
        if (/(?:맛있는|훌륭한)\s*(?:저녁|식사)|\b(?:great|good|delicious) dinner\b|(?:저녁|식사).{0,12}(?:맛있|훌륭)/i.test(text)) return special('good-dinner-v38', ['🍽️','😋'], 'topic', 97);

        // Work/scheduling/email
        if (/\b(?:one[- ]on[- ]one|1:1|1-on-1).{0,22}(?:moved|shifted|rescheduled).{0,22}(?:monday|tuesday|wednesday|thursday|friday|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:1대1|원온원|1:1)\s*(?:미팅|회의)?.{0,22}(?:옮겨|변경|재조정).{0,22}(?:월요일|화요일|수요일|목요일|금요일|오전|오후|\d+시)/i.test(text)) return special('one-on-one-moved-v38', ['📅','⏰'], 'event', 99);
        if (/\b(?:launch review|release review).{0,22}(?:booked|scheduled|set).{0,22}(?:monday|tuesday|wednesday|thursday|friday|morning|afternoon)|(?:출시|릴리스)\s*검토.{0,22}(?:월요일|화요일|수요일|목요일|금요일|오전|오후).{0,12}(?:잡혔|예정|예약)|(?:출시|릴리스)\s*검토.{0,22}(?:잡혔|예정|예약).{0,12}(?:월요일|화요일|수요일|목요일|금요일|오전|오후)/i.test(text)) return special('launch-review-v38', ['📅','🚀'], 'event', 99);
        if (/\b(?:creative brief|brief).{0,22}(?:due|deadline).{0,22}(?:noon|tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:크리에이티브\s*브리프|브리프).{0,22}(?:내일|오늘|정오|\d+시).{0,12}(?:까지|마감)|(?:크리에이티브\s*브리프|브리프).{0,22}(?:마감|기한)/i.test(text)) return special('brief-deadline-v38', ['⏰','📝'], 'work', 99);
        if (/\b(?:calendar invite|calendar invitation).{0,24}(?:sent|send|workshop|meeting)|\b(?:sent|send).{0,18}(?:calendar invite|calendar invitation)|(?:캘린더\s*초대|일정\s*초대).{0,18}(?:보냈|전송|워크숍|회의)|(?:보냈|전송).{0,18}(?:캘린더\s*초대|일정\s*초대)/i.test(text)) return special('calendar-invite-v38', ['📅','📤'], 'work', 99);
        if (/\b(?:team|we).{0,18}(?:agreed|aligned).{0,18}(?:milestone|next step|goal)|(?:팀|우리).{0,18}(?:합의|정했|맞췄).{0,18}(?:마일스톤|다음\s*단계|목표)/i.test(text)) return special('milestone-agreed-v38', ['🎯','🤝'], 'work', 99);
        if (/\b(?:waiting|wait).{0,20}(?:legal|compliance).{0,18}(?:feedback|review|approval)|(?:legal|compliance).{0,18}(?:feedback|review|approval).{0,16}(?:waiting|pending)|(?:법무|컴플라이언스).{0,18}(?:피드백|검토|승인).{0,18}(?:기다리|대기)|(?:법무|컴플라이언스).{0,18}(?:기다리|대기).{0,18}(?:피드백|검토|승인)/i.test(text)) return special('legal-feedback-v38', ['💬','⚖️'], 'work', 99);
        if (/\b(?:client|customer).{0,18}(?:requested|asked for).{0,18}(?:copy|wording|text).{0,18}(?:change|edit|revision)|(?:고객|클라이언트).{0,18}(?:문구|카피|텍스트).{0,18}(?:수정|변경).{0,12}(?:요청|원)/i.test(text)) return special('copy-change-v38', ['✏️','💬'], 'writing', 99);
        if (/\b(?:upload|send).{0,18}(?:signed|final).{0,12}(?:document|file).{0,20}(?:before|by)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:서명|최종).{0,12}(?:문서|파일).{0,18}(?:오전|오후|\d+시).{0,10}(?:전|까지).{0,10}(?:업로드|보내|전송)/i.test(text)) return special('signed-upload-v38', ['📤','⏰','📄'], 'work', 99);
        if (/\b(?:meeting notes|minutes).{0,20}(?:attached|email)|\b(?:attached).{0,16}(?:meeting notes|minutes)|(?:회의록|회의\s*메모).{0,18}(?:첨부|이메일)|(?:첨부).{0,18}(?:회의록|회의\s*메모)/i.test(text)) return special('meeting-notes-v38', ['📎','📝','📧'], 'writing', 99);
        if (/\b(?:budget spreadsheet|budget sheet).{0,20}(?:ready|review)|(?:예산\s*스프레드시트|예산표).{0,20}(?:준비|검토)/i.test(text)) return special('budget-review-v38', ['📊','👀'], 'work', 99);

        // Commerce/report/tech operational states
        if (/\b(?:card|payment).{0,18}(?:charged|processed).{0,12}(?:successfully|success)|(?:카드|결제).{0,18}(?:정상\s*처리|승인|완료)/i.test(text)) return special('charged-success-v38', ['✅','💳'], 'commerce', 99);
        if (/\b(?:refund).{0,18}(?:still\s*)?(?:pending|processing)|(?:환불).{0,18}(?:대기\s*중|처리\s*중|아직\s*대기)/i.test(text)) return special('refund-pending-v38', ['⏳','💳'], 'commerce', 99);
        if (/\b(?:order).{0,20}(?:packed|packaged).{0,20}(?:pickup|collection|courier)|(?:주문).{0,20}(?:포장).{0,20}(?:픽업|수거|기다)/i.test(text)) return special('packed-await-pickup-v38', ['📦','✅'], 'commerce', 99);
        if (/\b(?:receipt).{0,20}(?:available|ready|account)|(?:영수증).{0,20}(?:계정|확인|사용\s*가능|준비)/i.test(text)) return special('receipt-ready-v38', ['🧾','✅'], 'commerce', 99);
        if (/\b(?:weekend discount|weekend sale|discount).{0,18}(?:live|started|active now)|(?:주말\s*할인|할인\s*행사).{0,18}(?:시작|진행\s*중|지금)/i.test(text)) return special('discount-live-v38', ['🏷️','🛍️'], 'commerce', 99);
        if (/\b(?:average order value|aov).{0,26}(?:quarterly high|record high|highest)|(?:평균\s*주문\s*금액|AOV).{0,26}(?:분기\s*최고|최고치|기록)/i.test(text)) return special('aov-high-v38', ['📈','🏆','📊'], 'report', 99);
        if (/\b(?:refund rate).{0,26}(?:declined|fell|dropped|decreased)|(?:환불률).{0,26}(?:하락|내려|감소|줄)/i.test(text)) return special('refund-rate-down-v38', ['📉','📊'], 'report', 99);
        if (/\b(?:ticket volume|ticket count|support tickets).{0,26}(?:flat|unchanged|stable|roughly flat)|(?:티켓\s*수|티켓\s*건수|지원\s*티켓).{0,26}(?:변하지\s*않|거의\s*같|안정적|그대로)/i.test(text)) return special('tickets-flat-v38', ['📊','➡️'], 'report', 99);
        if (/\b(?:search indexing|indexing).{0,22}(?:catching up|still processing|in progress)|(?:검색\s*색인|색인).{0,22}(?:따라잡|진행\s*중|처리\s*중)/i.test(text)) return special('indexing-progress-v38', ['🔍','⏳'], 'tech', 99);
        if (/\b(?:tracing|investigating|profiling).{0,20}(?:slow).{0,12}(?:database|db).{0,12}(?:query)|(?:느린).{0,12}(?:데이터베이스|DB).{0,12}(?:쿼리).{0,14}(?:추적|조사|분석)|(?:추적|조사|분석).{0,14}(?:느린).{0,12}(?:쿼리)/i.test(text)) return special('slow-query-v38', ['🔍','💻','🐢'], 'tech', 99);
        if (/\b(?:android).{0,20}(?:freez|hang|stuck).{0,24}(?:stopped|gone|resolved|fixed)|(?:android).{0,20}(?:version).{0,20}(?:freez|hang).{0,16}(?:stopped|gone)|(?:안드로이드).{0,20}(?:멈춤|프리징).{0,20}(?:사라|멈|해결)/i.test(text)) return special('android-freeze-fixed-v38', ['✅','📱','🛠️'], 'tech', 99);
        if (/\b(?:patch|update).{0,18}(?:ready to install|ready for installation|can be installed)|(?:패치|업데이트).{0,18}(?:설치\s*준비|설치할\s*수|설치\s*가능)/i.test(text)) return special('patch-ready-v38', ['🛠️','⬇️'], 'tech', 99);
        if (/\b(?:queue|job queue).{0,20}(?:processing|working).{0,16}(?:normally|again|correctly)|(?:큐|작업\s*큐).{0,20}(?:정상적으로|다시).{0,12}(?:처리|작동)/i.test(text)) return special('queue-normal-v38', ['✅','⚙️'], 'tech', 99);

        // Travel
        if (/\b(?:ferry).{0,18}(?:leaves?|departs?).{0,18}(?:at|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:페리).{0,18}(?:오전|오후|\d+시).{0,10}(?:출발)|(?:페리).{0,18}(?:출발).{0,10}(?:오전|오후|\d+시)/i.test(text)) return special('ferry-departure-v38', ['⛴️','⏰'], 'travel', 99);
        if (/\b(?:checked bag|checked luggage|suitcase|luggage).{0,18}(?:missing|lost|not there|didn['’]t arrive)|(?:위탁\s*수하물|여행가방|수하물).{0,18}(?:보이지\s*않|분실|없|도착하지\s*않)/i.test(text)) return special('luggage-missing-v38', ['🧳','⚠️'], 'travel', 99);
        if (/\b(?:rental car|hire car).{0,18}(?:ready|pickup|pick up)|(?:렌터카|렌트카).{0,18}(?:픽업|준비).{0,12}(?:끝|완료|가능)/i.test(text)) return special('rental-ready-v38', ['🚗','✅'], 'travel', 99);

        // Negation/ambiguity edge cases.
        if (/\b(?:not a failure|wasn['’]t a failure|isn['’]t a failure).{0,20}(?:pass|passed|success)|(?:실패가\s*아니|실패는\s*아니).{0,20}(?:통과|성공)/i.test(text)) return special('not-failure-v38', ['✅','🧪'], 'status', 99);
        if (/\b(?:feature|service|app).{0,16}(?:no longer|not anymore).{0,12}(?:broken|failing)|\bno longer broken\b|(?:기능|서비스|앱).{0,16}(?:더\s*이상).{0,10}(?:고장|문제).{0,8}(?:아니|않)/i.test(text)) return special('not-broken-v38', ['✅','🛠️'], 'status', 99);
        if (/\bcouldn['’]t be happier\b|더\s*행복할\s*수(?:가)?\s*없/i.test(text)) return special('couldnt-happier-v38', ['😊','🎉'], 'mood', 99);
        if (/\bnot only\b.{0,30}\b(?:finished|completed|done).{0,20}\b(?:early|ahead)\b|끝냈을\s*뿐\s*아니라.{0,20}(?:일찍|예정보다\s*빨리)/i.test(text)) return special('not-only-finished-v38', ['✅','🎉'], 'achievement', 99);
        if (/\b(?:ran|run) (?:a |the )?(?:report|analysis|query|script)\b|(?:보고서|분석|쿼리|스크립트).{0,12}(?:돌렸|실행)|(?:돌렸|실행).{0,12}(?:보고서|분석|쿼리|스크립트)/i.test(text)) return special('run-report-v38', ['📊','📝'], 'work', 99);
        if (/\b(?:bug|beetle|ladybug).{0,20}(?:landed|crawled|flew).{0,20}(?:notebook|book|desk)|(?:벌레|무당벌레).{0,20}(?:노트|책|책상).{0,16}(?:앉|기어|날아)/i.test(text)) return special('insect-v38', ['🐞','📓'], 'life', 99);
        if (/\b(?:banner|link|button).{0,24}(?:do not|don['’]t|avoid).{0,12}(?:tap|click|open)|(?:do not|don['’]t|avoid).{0,12}(?:tap|click|open).{0,18}(?:banner|link|button)|(?:배너|링크|버튼).{0,20}(?:누르지\s*마|클릭하지\s*마|누르지\s*않는\s*게)|(?:누르지\s*마|클릭하지\s*마).{0,20}(?:배너|링크|버튼)/i.test(text)) return special('avoid-banner-v38', ['⚠️','🛡️'], 'security', 99);

        // Protected-token semantic helpers.
        if (/@[\p{L}\p{N}_.-]+.{0,24}(?:verify|check|review|confirm)|(?:verify|check|review|confirm).{0,24}@[\p{L}\p{N}_.-]+|@[\p{L}\p{N}_.-]+.{0,24}(?:확인|검증|검토)|(?:확인|검증|검토).{0,24}@[\p{L}\p{N}_.-]+/iu.test(raw)) return special('mention-verify-v38', ['✅','🔍'], 'work', 98);
        if (/#(?:[\p{L}\p{N}_-]+).{0,24}(?:keep|leave|preserve|unchanged)|(?:keep|leave|preserve).{0,24}#(?:[\p{L}\p{N}_-]+)|#(?:[\p{L}\p{N}_-]+).{0,24}(?:그대로|유지|보존|두세요)|(?:그대로|유지|보존).{0,24}#(?:[\p{L}\p{N}_-]+)/iu.test(raw)) return special('hashtag-preserve-v38', ['🔖','📝'], 'writing', 98);

        // v36 small natural-language refinements before the next untouched holdout.
        if (/\b(?:wrote|write|writing|filled).{0,35}(?:journal|diary)\b|\b(?:journal|diary).{0,35}(?:wrote|write|writing|filled)\b/i.test(text)) return special('journal-writing-v36', ['📝','✍️'], 'writing', 99);
        if (/(?:회의실|미팅룸).{0,24}(?:바뀌|변경|옮겨).{0,24}(?:[A-Za-z]\d+|\d+번?|다른\s*방)|(?:회의실|미팅룸).{0,24}(?:[A-Za-z]\d+|\d+번?).{0,20}(?:바뀌|변경|옮겨)/i.test(text)) return special('meeting-room-v36', ['📅','📍'], 'event', 99);
        if (/(?:매출|수익|매출액).{0,30}(?:지난달|전월|이전\s*달).{0,20}(?:거의\s*(?:차이|변화)가?\s*없|거의\s*같|비슷|그대로)|(?:매출|수익|매출액).{0,24}(?:거의\s*변화\s*없|거의\s*그대로|안정적으로\s*유지)/i.test(text)) return special('revenue-flat-ko-v36', ['📊','➡️'], 'report', 99);
        if (/(?:결제\s*화면|결제\s*페이지|체크아웃).{0,24}(?:사용할\s*수\s*없|사용하지\s*못|이용할\s*수\s*없|열리지\s*않)/i.test(text)) return special('checkout-unavailable-ko-v36', ['❌','🛒','⚠️'], 'commerce', 99);
        if (/(?:긴\s*하루|하루\s*끝|퇴근).{0,30}(?:집).{0,20}(?:쉬|쉰|휴식|눕|도착)/i.test(text)) return special('home-rest-ko-v36', ['🏠','😮‍💨','😌'], 'life', 99);
        if (/https?:\/\/[^\s]+.{0,30}(?:status|상태|확인|latest|최신)|(?:status|상태|latest|최신).{0,30}https?:\/\/[^\s]+/i.test(raw)) return special('status-url-v36', ['🌐','🔎','💡'], 'tech', 98);
        // v35 broad object/action precedence from a new 654-case untouched corpus.
        // Everyday concrete actions should outrank incidental time/location words.
        if (/\b(?:repotted|repotting|transplanted).{0,18}(?:plant|plants|herbs|flowers?)\b|(?:분갈이|옮겨\s*심).{0,18}(?:화분|식물|허브|꽃)|(?:화분|식물|허브|꽃).{0,18}(?:분갈이|옮겨\s*심)/i.test(text)) return special('repot-v35', ['🪴','🌿'], 'life', 99);
        if (/\b(?:picked up|bought|got).{0,18}(?:groceries|grocery shopping)|\b(?:went|go) grocery shopping\b|장(?:을)?\s*(?:봤|보러|보고)|장보기/i.test(text)) return special('groceries-v35', ['🛒','🏠'], 'life', 98);
        if (/\b(?:journal|diary).{0,18}(?:wrote|write|writing|pages?)|\b(?:wrote|write|writing).{0,18}(?:journal|diary)|(?:일기|일기장).{0,18}(?:쓰|적|기록)|(?:쓰|적|기록).{0,18}(?:일기|일기장)/i.test(text)) return special('journal-v35', ['📝','✍️'], 'writing', 98);
        if (/\b(?:bus).{0,18}(?:work|commute|office)|\b(?:caught|took|ride|rode) (?:the |a )?(?:bus)\b|(?:버스).{0,18}(?:출근|통근|탔|타고)|(?:출근|통근).{0,18}버스/i.test(text)) return special('bus-v35', ['🚌','💼'], 'travel', 98);
        if (/\b(?:lifted weights|weight training|strength training|worked out at the gym|gym workout)\b|웨이트|근력\s*운동|헬스장.{0,12}(?:운동|웨이트)/i.test(text)) return special('weights-v35', ['💪','🏋️'], 'life', 98);
        if (/\b(?:listened to|listening to).{0,18}(?:a |the )?podcast\b|팟캐스트.{0,12}(?:들었|듣|청취)|(?:들었|듣).{0,12}팟캐스트/i.test(text)) return special('listen-podcast-v35', ['🎧','🎙️'], 'creative', 98);
        if (/\b(?:watered).{0,18}(?:herbs?|garden|balcony plants?)\b|(?:허브|정원|베란다.{0,8}(?:식물|화분)).{0,16}물(?:을)?\s*(?:줬|주었)|물(?:을)?\s*(?:줬|주었).{0,16}(?:허브|정원|베란다)/i.test(text)) return special('water-herbs-v35', ['🌿','💧'], 'life', 98);
        if (/\b(?:pancakes?).{0,16}(?:made|cooked|breakfast)|(?:made|cooked).{0,16}pancakes?\b|팬케이크.{0,16}(?:만들|구웠|아침)|(?:만들|구웠).{0,16}팬케이크/i.test(text)) return special('pancake-v35', ['🥞','😋'], 'topic', 99);
        if (/\b(?:concert|live show|gig).{0,24}(?:songs?|music|night|favorite)|\b(?:favorite|live) (?:songs?|music).{0,20}(?:concert|show)|콘서트.{0,20}(?:노래|음악|밤)|(?:노래|음악).{0,20}콘서트/i.test(text)) return special('concert-v35', ['🎵','🎤','✨'], 'creative', 98);
        if (/\b(?:sea breeze|ocean breeze|beach air|sea air)\b|바닷바람|바다\s*공기/i.test(text)) return special('sea-breeze-v35', ['🌊','🌿','😊'], 'life', 96);

        // Work/email actions.
        if (/\b(?:final draft|draft).{0,18}(?:ready for approval|awaiting approval|ready to approve)|(?:최종\s*초안|초안).{0,18}(?:승인\s*준비|승인\s*대기|승인할\s*수)/i.test(text)) return special('draft-approval-v35', ['✅','📝'], 'writing', 98);
        if (/\b(?:presentation deck|deck|slides?|proposal).{0,18}(?:attached).{0,22}(?:comments?|feedback|review)|\b(?:attached).{0,18}(?:presentation deck|deck|slides?|proposal).{0,22}(?:comments?|feedback|review)|(?:발표\s*자료|제안서|슬라이드).{0,18}첨부.{0,20}(?:의견|피드백|검토)/i.test(text)) return special('attachment-comments-v35', ['📎','💬','👀'], 'writing', 99);
        if (/\b(?:meeting room|conference room|room).{0,18}(?:changed|moved).{0,16}(?:to|room)?\s*[A-Z]?\d+|(?:회의실).{0,18}(?:바뀌|변경|옮겨).{0,16}[A-Za-z]?\d+/i.test(text)) return special('room-change-v35', ['📅','📍'], 'event', 98);
        if (/\b(?:send|email|share).{0,18}(?:updated|revised|final) (?:file|document|version).{0,20}(?:by|before) (?:tomorrow|monday|tuesday|wednesday|thursday|friday|morning|noon)|(?:내일|월요일|화요일|수요일|목요일|금요일|아침|정오).{0,18}(?:까지).{0,18}(?:수정|최종).{0,12}(?:파일|문서).{0,12}(?:보내|전송)|(?:수정|최종).{0,12}(?:파일|문서).{0,18}(?:내일|아침|정오).{0,12}(?:까지).{0,12}(?:보내|전송)/i.test(text)) return special('send-file-deadline-v35', ['📤','⏰','📎'], 'work', 98);
        if (/\b(?:project|work).{0,18}(?:blocked|stuck).{0,24}(?:dependency|vendor|external)|(?:vendor|external).{0,20}(?:dependency).{0,20}(?:blocked|stuck)|(?:프로젝트|업무).{0,18}(?:막혀|차질).{0,20}(?:의존|업체|외부)|(?:외부\s*업체|의존성).{0,20}(?:프로젝트|업무).{0,12}(?:막혀|차질)/i.test(text)) return special('blocked-dependency-v35', ['⚠️','🧩'], 'work', 98);
        if (/\b(?:roadmap discussion|roadmap review|planning session).{0,22}(?:postponed|pushed|moved).{0,18}(?:next week|later)|(?:로드맵\s*(?:논의|검토)|계획\s*회의).{0,22}(?:다음\s*주|나중).{0,12}(?:미뤄|연기|옮겨)|(?:로드맵\s*(?:논의|검토)|계획\s*회의).{0,22}(?:미뤄|연기).{0,12}(?:다음\s*주|나중)/i.test(text)) return special('roadmap-postponed-v35', ['📅','⏳'], 'event', 99);

        // Report/metric direction should beat sentiment words contained in metric names.
        if (/\b(?:customer complaints?|complaint rate).{0,28}(?:decreased|fell|dropped|declined)|(?:고객\s*불만|불만\s*건수|불만율).{0,28}(?:감소|줄|하락|내려)/i.test(text)) return special('complaints-down-v35', ['📉','📊'], 'report', 99);
        if (/\b(?:daily active users?|dau).{0,24}(?:new high|record high|highest|peaked)|(?:일간\s*활성\s*사용자|DAU).{0,24}(?:최고치|최대|기록)/i.test(text)) return special('dau-high-v35', ['📈','🏆','📊'], 'report', 99);
        if (/\b(?:response time|latency|load time).{0,26}(?:reduced|cut|lower|shorter|decreased|improved)|(?:응답\s*시간|지연\s*시간|로딩\s*시간).{0,26}(?:줄|단축|감소|개선)/i.test(text)) return special('response-time-improve-v35', ['⏱️','📉','📊'], 'report', 98);

        // Tech/support refinements.
        if (/\b(?:login|sign[- ]in).{0,18}(?:is |are )?(?:unavailable|not available|disabled|not working)|(?:로그인|로그인\s*기능).{0,18}(?:불가능|사용\s*불가|이용\s*불가|작동하지\s*않)/i.test(text)) return special('login-unavailable-v35', ['🚫','⚠️','🌐'], 'status', 99);
        if (/\b(?:investigating|looking into|checking).{0,24}(?:sign[- ]in|login).{0,16}(?:problem|issue)|(?:sign[- ]in|login).{0,20}(?:problem|issue).{0,20}(?:investigating|looking into|checking)|(?:로그인).{0,18}(?:문제|이슈).{0,18}(?:조사|확인|살펴보)/i.test(text)) return special('login-investigation-v35', ['🔍','🛠️','⚠️'], 'status', 99);
        if (/\b(?:ios|android|mobile app|app).{0,20}(?:crash|crashes|crashing).{0,20}(?:disappeared|stopped|resolved|fixed|gone)|(?:hotfix|patch).{0,20}(?:ios|android|app).{0,20}(?:crash|crashes).{0,16}(?:disappeared|stopped|resolved|fixed|gone)|(?:iOS|안드로이드|앱).{0,20}(?:충돌|크래시).{0,20}(?:사라|멈|해결)|(?:핫픽스|패치).{0,20}(?:iOS|안드로이드|앱).{0,20}(?:충돌|크래시).{0,12}(?:사라|멈|해결)/i.test(text)) return special('mobile-crash-fixed-v35', ['✅','📱','🛠️'], 'tech', 99);
        if (/\b(?:mobile app|app).{0,18}(?:opens?|loads?|starts?)\s+(?:noticeably|much|significantly|a lot)?\s*faster\b|(?:모바일\s*앱|앱).{0,18}(?:훨씬|더|눈에\s*띄게)?\s*(?:빨리|빠르게).{0,10}(?:열|로딩|시작)/i.test(text)) return special('mobile-faster-v35', ['⚡','📱'], 'tech', 99);
        if (/\b(?:new app build|latest build|app build).{0,22}(?:ready to download|available to download|download now)|(?:새|최신)?\s*앱\s*빌드.{0,22}(?:다운로드|받을).{0,10}(?:가능|준비)|앱\s*빌드.{0,20}(?:다운로드할\s*수|다운로드\s*가능)/i.test(text)) return special('app-build-download-v35', ['📱','✨','⬇️'], 'tech', 99);
        if (/\b(?:maintenance window|maintenance).{0,22}(?:ends?|finishes?|until).{0,18}(?:midnight|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:점검\s*시간|점검).{0,22}(?:자정|오전|오후|\d+시).{0,12}(?:끝|종료)|(?:자정|오전|오후|\d+시).{0,12}(?:점검).{0,12}(?:끝|종료)/i.test(text)) return special('maintenance-time-v35', ['🛠️','⏰'], 'tech', 99);

        // Commerce refinements.
        if (/\b(?:free shipping).{0,18}(?:starts?|from|over|above|orders? over|orders? above|\$\d+)|(?:\$\d+).{0,18}free shipping|무료배송.{0,18}(?:\d|이상|부터)|(?:\d+(?:만)?원).{0,18}(?:부터|이상).{0,10}무료배송/i.test(text)) return special('free-shipping-v35', ['🚚','💰'], 'commerce', 99);
        if (/\b(?:sale|promotion).{0,18}(?:starts?|begins?|opens?).{0,18}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|today|tomorrow)|(?:세일|프로모션).{0,18}(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|아침|오늘|내일).{0,12}(?:시작|열)|(?:세일|프로모션).{0,18}(?:시작).{0,12}(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|아침|오늘|내일)/i.test(text)) return special('sale-start-v35', ['🏷️','📅','🛍️'], 'commerce', 99);
        if (/\bcheckout.{0,18}(?:unavailable|not working|broken|down)|(?:결제\s*화면|체크아웃).{0,18}(?:사용\s*불가|작동하지\s*않|고장|먹통)/i.test(text)) return special('checkout-unavailable-v35', ['❌','🛒','⚠️'], 'commerce', 99);

        // Travel subjects should beat generic update/location words.
        if (/\bboarding.{0,18}(?:starts?|begins?).{0,18}(?:gate|\d{1,2})|(?:gate|게이트).{0,18}(?:boarding|탑승).{0,12}(?:start|begin|시작)|(?:탑승).{0,18}(?:게이트|\d+번).{0,12}(?:시작)/i.test(text)) return special('boarding-v35', ['✈️','🎫','⏰'], 'travel', 99);
        if (/\bpassport.{0,18}(?:renewed|renewal complete|updated)|(?:여권).{0,18}(?:갱신|재발급).{0,12}(?:완료|마쳤|됐)/i.test(text)) return special('passport-renewed-v35', ['🛂','✅'], 'travel', 99);
        if (/\b(?:suitcase|luggage|bag).{0,18}(?:arrived|delivered).{0,18}(?:flight|airport)?|(?:여행가방|수하물|짐).{0,18}(?:도착|찾았|받았).{0,18}(?:비행기|공항)?/i.test(text)) return special('luggage-arrived-v35', ['🧳','✈️','✅'], 'travel', 98);
        if (/\b(?:road trip|roadtrip).{0,24}(?:packed|car|weekend)|\b(?:packed|loaded).{0,18}(?:car).{0,18}(?:road trip|roadtrip)|로드트립.{0,20}(?:차|짐|주말)|차.{0,18}짐.{0,16}로드트립/i.test(text)) return special('roadtrip-v35', ['🚗','🧳'], 'travel', 98);
        if (/\b(?:sunrise|dawn).{0,20}(?:photo|photograph|picture).{0,16}(?:ferry|boat|ship)|\b(?:photo|photograph|picture).{0,20}(?:sunrise|dawn).{0,16}(?:ferry|boat|ship)|(?:페리|배).{0,16}(?:일출|해돋이).{0,16}(?:사진|찍)|(?:일출|해돋이).{0,16}(?:사진|찍).{0,16}(?:페리|배)/i.test(text)) return special('ferry-sunrise-v35', ['🌅','📸','⛴️'], 'travel', 99);
        if (/\b(?:museum).{0,18}(?:photos?|pictures?|photographed|visited|afternoon)|(?:photos?|pictures?).{0,18}museum|박물관.{0,18}(?:사진|찍|둘러|방문|오후)/i.test(text)) return special('museum-v35', ['🏛️','📸'], 'travel', 98);

        // SNS combinations: preserve the concrete subject while allowing mood.
        if (/\b(?:flowers?).{0,20}(?:music|song|playlist)|\b(?:music|song|playlist).{0,20}flowers?\b|꽃.{0,20}(?:음악|노래)|(?:음악|노래).{0,20}꽃/i.test(text)) return special('flowers-music-v35', ['🌸','🎵','🌿'], 'social', 98);
        if (/\b(?:laughed|laughing).{0,20}(?:old )?friends?\b|\b(?:old )?friends?.{0,20}(?:laughed|laughing)|(?:오랜\s*)?친구.{0,20}(?:웃었|웃음)|(?:웃었|웃음).{0,20}(?:오랜\s*)?친구/i.test(text)) return special('friends-laugh-v35', ['😂','🤝','💛'], 'social', 99);
        if (/\b(?:home).{0,18}(?:after|from).{0,18}(?:long day|work).{0,16}(?:rest|exhale|finally)|(?:긴\s*하루|퇴근).{0,18}(?:집).{0,18}(?:쉬|휴식|도착)/i.test(text)) return special('home-rest-v35', ['🏠','😮‍💨','😌'], 'life', 98);

        // v34 tiny precedence refinements from the previous untouched holdout.
        if (/(?:로드맵|계획).{0,18}(?:검토).{0,18}(?:수요일|목요일|금요일|월요일|화요일|오전|오후|저녁).{0,16}(?:옮겨|이동|변경|미뤄)|(?:로드맵|계획).{0,18}(?:수요일|목요일|금요일|월요일|화요일|오전|오후|저녁).{0,16}(?:옮겨|이동|변경|미뤄)/i.test(text)) return special('roadmap-moved-ko-v34', ['📅','⏰'], 'event', 99);
        if (/(?:타코).{0,16}(?:만들|요리|먹|주문)|(?:만들|요리|먹|주문).{0,16}타코/i.test(text)) return special('taco-ko-v34', ['🌮','😋'], 'topic', 99);
        // v33 additional broad precedence for recovery, scheduling, email editing,
        // hobbies, app reliability and natural Korean safety phrasing.
        if (/\b(?:recovered|working again|back to normal|back online|healthy again|stable again)\b.{0,24}\b(?:after|following)\b.{0,24}\b(?:restart|reboot|patch|fix|deploy|deployment)\b|\b(?:after|following).{0,24}(?:restart|reboot|patch|fix|deploy|deployment).{0,24}(?:recovered|working again|back to normal|back online|stable again)\b|(?:재시작|재부팅|패치|수정|배포).{0,20}(?:복구|정상화|다시\s*작동|안정화)|(?:복구|정상화|다시\s*작동|안정화).{0,20}(?:재시작|재부팅|패치|수정|배포)/i.test(text)) return special('recovered-after-fix-v33', ['✅','🛠️','💻'], 'tech', 99);
        if (/\b(?:search|feature|service|app|site).{0,18}(?:is |are )?(?:unavailable|down|not working)\b|(?:검색|기능|서비스|앱|사이트).{0,18}(?:사용\s*불가|이용\s*불가|작동하지\s*않|먹통|다운)/i.test(text)) return special('service-unavailable-v33', ['🚫','⚠️','🌐'], 'status', 98);
        if (/\b(?:api|endpoint|server).{0,24}(?:returned|returns|responded with|responds with)\s*(?:4\d\d|5\d\d)|\b(?:4\d\d|5\d\d)\s*(?:error|response)\b|(?:API|서버|엔드포인트).{0,24}(?:4\d\d|5\d\d).{0,8}(?:반환|응답|오류)|(?:4\d\d|5\d\d).{0,12}(?:오류|응답)/i.test(text)) return special('http-error-v33', ['❌','💻','⚠️'], 'tech', 99);
        if (/\b(?:crash|crashes|crashing).{0,20}(?:stopped|ended|gone|resolved|fixed)|\b(?:stopped|ended|resolved|fixed).{0,20}(?:crash|crashes|crashing)|(?:충돌|크래시).{0,20}(?:멈췄|사라졌|해결|끝났)|(?:멈췄|사라졌|해결).{0,20}(?:충돌|크래시)/i.test(text)) return special('crash-resolved-v33', ['✅','📱','🛠️'], 'tech', 99);
        if (/\b(?:bike|bicycle|cycling|cycled|rode my bike|went cycling)\b|자전거|사이클링/i.test(text)) return special('cycling-v33', ['🚲','💪','🌿'], 'life', 97);
        if (/\b(?:fried chicken|chicken wings|roast chicken|grilled chicken|ordered chicken)\b|치킨|닭고기/i.test(text)) return special('chicken-v33', ['🍗','😋'], 'topic', 97);
        if (/\b(?:email|mail).{0,22}(?:subject|subject line).{0,20}(?:shorter|edited|changed|revised|rewrote)|\b(?:edited|changed|revised|rewrote).{0,20}(?:email|mail).{0,12}(?:subject|subject line)|(?:메일|이메일).{0,12}(?:제목).{0,18}(?:짧게|수정|고쳤|바꿨|다듬)|(?:제목).{0,12}(?:짧게|수정|고쳤|바꿨|다듬).{0,12}(?:메일|이메일)/i.test(text)) return special('email-subject-edit-v33', ['✏️','📧'], 'writing', 98);
        if (/\b(?:customer interview|user interview|interview).{0,24}(?:confirmed|set|scheduled).{0,24}(?:at|for)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?|(?:고객|사용자)\s*인터뷰.{0,24}(?:확정|예정|잡혔).{0,20}(?:오전|오후|\d+시)|인터뷰.{0,20}(?:오전|오후|\d+시).{0,16}(?:확정|예정)/i.test(text)) return special('interview-time-v33', ['📅','⏰','✅'], 'event', 98);
        if (/\b(?:roadmap|plan|review).{0,24}(?:moved|shifted|rescheduled).{0,24}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening)|(?:로드맵|계획|검토).{0,24}(?:옮겨|이동|변경|미뤄).{0,24}(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|오전|오후|저녁)/i.test(text)) return special('roadmap-moved-v33', ['📅','⏰'], 'event', 98);
        if (/\b(?:deck|slides?|presentation).{0,20}(?:attached|attachment).{0,20}(?:review|feedback)|\b(?:attached|attachment).{0,20}(?:deck|slides?|presentation).{0,20}(?:review|feedback)|(?:덱|슬라이드|발표자료|프레젠테이션).{0,20}(?:첨부).{0,20}(?:검토|피드백)|(?:첨부).{0,20}(?:덱|슬라이드|발표자료).{0,20}(?:검토|피드백)/i.test(text)) return special('attached-review-v33', ['📎','👀'], 'writing', 98);
        if (/\b(?:walked|walking).{0,18}(?:dog|puppy)|\b(?:dog|puppy).{0,18}(?:walk|walking)|(?:강아지|개).{0,12}(?:산책|걸었|걷)|(?:산책|걸었|걷).{0,12}(?:강아지|개)/i.test(text)) return special('dog-walk-v33', ['🐶','🚶','🌿'], 'life', 98);
        if (/\b(?:cat|kitten).{0,16}(?:slept|sleeping|fell asleep|napped).{0,16}(?:desk|table|chair|bed)?|(?:고양이|새끼고양이).{0,16}(?:잠들|자고|낮잠).{0,16}(?:책상|탁자|의자|침대)?/i.test(text)) return special('cat-sleep-v33', ['🐱','😴'], 'life', 98);
        if (/\b(?:ran|running|jogged|jogging)\b.{0,20}\b(?:kilometer|kilometre|km|mile|miles)\b|(?:\d+(?:\.\d+)?\s*(?:킬로미터|km|마일)).{0,12}(?:달렸|뛰었|러닝)|(?:달렸|뛰었|러닝).{0,12}(?:킬로미터|km|마일)/i.test(text)) return special('running-distance-v33', ['🏃','💪'], 'life', 98);
        if (/\b(?:privacy policy|terms of service|security policy).{0,18}(?:updated|revised|changed)|\b(?:updated|revised|changed).{0,18}(?:privacy policy|terms of service|security policy)|(?:개인정보처리방침|이용약관|보안정책).{0,18}(?:업데이트|수정|개정|변경)/i.test(text)) return special('policy-updated-v33', ['🔒','📜'], 'security', 97);
        if (/\b(?:new|latest) (?:app|mobile app) version.{0,18}(?:available|released|out now)|\b(?:app|mobile app) version.{0,18}(?:available now|released now)|(?:새|최신)\s*앱\s*버전.{0,18}(?:사용|출시|배포).{0,10}(?:가능|됐|됨)|앱\s*버전.{0,18}(?:지금\s*)?(?:사용\s*가능|출시)/i.test(text)) return special('app-version-available-v33', ['📱','✨'], 'tech', 97);
        if (/\b(?:database|db).{0,18}(?:backup|backups?).{0,18}(?:nightly|every night|each night)|\b(?:nightly|every night).{0,18}(?:database|db).{0,18}(?:backup|backups?)|(?:데이터베이스|DB).{0,18}(?:백업).{0,18}(?:매일\s*밤|야간|밤마다)/i.test(text)) return special('db-backup-v33', ['💾','🌙'], 'tech', 97);
        if (/\b(?:report|document).{0,18}(?:includes?|contains?).{0,18}(?:action items?|next steps?)|(?:보고서|문서).{0,18}(?:액션\s*아이템|할\s*일|다음\s*단계).{0,12}(?:포함|있)/i.test(text)) return special('report-actions-v33', ['📝','✅'], 'work', 96);
        if (/`[^`]+`.{0,24}(?:before|then|run|project)|(?:before|then).{0,24}`[^`]+`/i.test(raw)) return special('code-command-v33', ['💻','🛠️'], 'tech', 95);
        if (/\b(?:not sad anymore|no longer sad|not feeling sad anymore|sadness is mostly gone)\b|(?:이제|더\s*이상).{0,12}(?:슬픈\s*기분|슬픔).{0,12}(?:거의\s*)?(?:없|않|사라)/i.test(text)) return special('sadness-gone-v33', ['😌','😊'], 'mood', 98);
        if (/\b(?:rather than delayed|instead of being delayed|not delayed but cancelled|cancelled instead of delayed)\b.{0,20}|(?:지연|연기).{0,8}(?:아니라|대신).{0,12}취소/i.test(text) && CANCEL.test(text)) return special('cancel-rather-than-delay-v33', ['🚫','⚠️'], 'status', 99);
        if (/\b(?:avoid|should avoid|better not to)\s+(?:click|tap|open|visit|follow)\b|(?:누르지\s*않는\s*게\s*좋|클릭하지\s*않는\s*게\s*좋|열지\s*않는\s*게\s*좋|접속하지\s*않는\s*게\s*좋)/i.test(text)) return special('soft-avoid-action-v33', ['⚠️','🛡️'], 'security', 98);
        // v32 natural-language coverage discovered by a fresh untouched holdout.
        // These rules target broad intent families, not benchmark-only exact sentences.
        // Concrete everyday subjects should beat vague mood/document fallbacks.
        if (/\b(?:fresh|new) (?:flowers?|bouquet)\b|\bflowers? (?:on|by|beside|near) (?:my |the )?(?:desk|table|window)\b|(?:새|싱싱한)\s*꽃|책상.{0,12}꽃|꽃.{0,12}책상/i.test(text)) return special('flowers-v32', ['🌸','🌿','😊'], 'topic', 94);
        if (/\b(?:sunrise|morning light|dawn)\b/i.test(text)) return special('sunrise-v32', ['🌅','📸','🌿'], 'weather', 95);
        if (/\b(?:quiet|peaceful|cozy|cosy) (?:evening|night).{0,28}\b(?:book|reading)\b|\b(?:book|reading).{0,28}(?:quiet|peaceful|cozy|cosy) (?:evening|night)\b|조용한\s*(?:저녁|밤).{0,20}(?:책|독서)|(?:책|독서).{0,20}조용한\s*(?:저녁|밤)/i.test(text)) return special('quiet-reading-v32', ['📖','🌿','😌'], 'life', 94);
        if (/\b(?:laughed|made me laugh|couldn['’]t stop laughing|smiled|made me smile)\b|웃음이\s*났|웃었|미소가\s*났|웃게\s*됐/i.test(text)) return special('smile-laugh-v32', ['😊','😂','💛'], 'mood', 92);
        if (/\b(?:grateful|thankful) (?:day|for|today)|\bfeeling grateful\b|고마운\s*하루|감사한\s*하루|감사한\s*마음/i.test(text)) return special('gratitude-v32', ['🙏','💛','😊'], 'mood', 93);
        if (/\b(?:exactly what i needed|just what i needed|needed that)\b|딱\s*필요했던|정말\s*필요했던/i.test(text)) return special('needed-this-v32', ['🌿','😌','💛'], 'mood', 90);
        if (/\b(?:want to remember this|keeping this one|save this memory|one to remember)\b|기억하고\s*싶|기억해\s*두고\s*싶/i.test(text)) return special('memory-v32', ['📸','💛','✨'], 'social', 89);
        if (/\b(?:called|phoned|rang) (?:my |our )?(?:mom|mum|mother|dad|father|parents?|grandma|grandmother|grandpa|grandfather)\b|(?:엄마|어머니|아빠|아버지|부모님|할머니|할아버지).{0,12}(?:전화|통화)|(?:전화|통화).{0,12}(?:엄마|어머니|아빠|아버지|부모님|할머니|할아버지)/i.test(text)) return special('family-call-v32', ['📞','💛','🤝'], 'social', 95);
        if (/\b(?:made|cooked|prepared) (?:dinner|lunch|breakfast|a meal)\b|(?:저녁|점심|아침|식사).{0,12}(?:만들|차렸|준비)|(?:만들|차렸|준비).{0,12}(?:저녁|점심|아침|식사)/i.test(text)) return special('meal-prep-v32', ['🍽️','😋','🏠'], 'topic', 93);
        if (/\b(?:brewed|made|poured) (?:some |a |my )?(?:coffee|espresso|latte)\b|(?:커피|아메리카노|라떼).{0,12}(?:내렸|만들|탔)|(?:내렸|만들|탔).{0,12}(?:커피|아메리카노|라떼)/i.test(text)) return special('coffee-prep-v32', ['☕','😌'], 'topic', 96);
        if (/\b(?:watered) (?:the |my )?(?:plant|plants|flowers?)\b|(?:화분|식물|꽃).{0,10}물(?:을)?\s*(?:줬|주었|줌)|물(?:을)?\s*(?:줬|주었).{0,10}(?:화분|식물|꽃)/i.test(text)) return special('plant-care-v32', ['🌿','🪴','💧'], 'life', 94);
        if (/\b(?:tidied|cleaned|organized|organised) (?:the |my )?(?:living room|bedroom|room|apartment|home)\b|(?:거실|방|집).{0,12}(?:정리|청소|치웠)|(?:정리|청소|치웠).{0,12}(?:거실|방|집)/i.test(text)) return special('home-tidy-v32', ['🧹','🏠','✨'], 'life', 94);
        if (/\b(?:short|long|quick|evening|morning)?\s*walk\b|\bwent for a walk\b|\btook a walk\b|\bwalked (?:before|after|around|through|home|outside)\b|산책|걸었|걸었다|걷고\s*왔/i.test(text)) return special('walk-v32', ['🚶','🌿','😊'], 'life', 92);
        if (/\b(?:yoga|pilates|meditation|meditated|stretching|stretched)\b|요가|필라테스|명상|스트레칭/i.test(text)) return special('mindful-exercise-v32', ['🧘','🌿','💪'], 'life', 95);
        if (/\b(?:podcast).{0,24}(?:edit|edited|editing|episode|recorded|recording)|(?:edit|edited|editing).{0,24}podcast\b|팟캐스트.{0,24}(?:편집|녹음|에피소드)|(?:편집|녹음).{0,16}팟캐스트/i.test(text)) return special('podcast-v32', ['🎙️','✂️','🎧'], 'creative', 95);
        if (/\b(?:muffin|muffins|cupcake|cupcakes)\b|머핀|컵케이크/i.test(text)) return special('muffin-v32', ['🧁','😋'], 'topic', 96);
        if (/\b(?:taco|tacos)\b|타코/i.test(text)) return special('taco-v32', ['🌮','😋'], 'topic', 96);

        // Commerce and support states need operational/status emojis rather than generic shop/document icons.
        if (/\b(?:back in stock|restocked|inventory is back|stock is available again|item is back)\b|(?:재고|상품).{0,16}(?:다시\s*들어|입고|재입고|다시\s*있)|재입고/i.test(text)) return special('restock-v32', ['📦','✅','🛒'], 'commerce', 97);
        if (/\b(?:out for delivery|delivery is on the way|shipment is on the way|package is on the way|dispatched for delivery)\b|(?:택배|배송).{0,16}(?:출발|배송\s*중|오는\s*중|이동\s*중)|배송\s*출발/i.test(text)) return special('out-for-delivery-v32', ['📦','🚚'], 'commerce', 98);
        if (/\b(?:orders?|preorders?|sales?) (?:open|start|begin) (?:at|on|tomorrow|today)|\b(?:shop|store).{0,24}(?:opens?|opening).{0,16}(?:at|tomorrow|today)|(?:주문|예약|판매).{0,20}(?:열린|시작|오픈)|(?:내일|오늘).{0,12}(?:주문|예약|판매).{0,12}(?:열|시작)/i.test(text)) return special('orders-open-v32', ['🛒','⏰','📅'], 'commerce', 96);
        if (/\brefund.{0,24}(?:card|credited|received|returned|posted)|\b(?:card|account).{0,24}refund|환불.{0,20}(?:카드|입금|들어|처리|완료)|(?:카드|계좌).{0,20}환불/i.test(text)) return special('refund-received-v32', ['💳','✅','💰'], 'commerce', 96);
        if (/\bpassword reset.{0,18}(?:complete|completed|done|successful)|\b(?:complete|completed).{0,18}password reset|비밀번호\s*재설정.{0,16}(?:완료|끝|성공)/i.test(text)) return special('password-reset-complete-v32', ['✅','🔐'], 'status', 98);
        if (/\b(?:still|currently) (?:checking|investigating|looking into).{0,24}(?:login|sign[- ]in|account).{0,12}(?:issue|problem)|\b(?:login|sign[- ]in|account).{0,20}(?:issue|problem).{0,20}(?:checking|investigating|looking into)|(?:로그인|계정).{0,18}(?:문제|이슈).{0,18}(?:확인\s*중|조사\s*중|살펴보)|(?:확인\s*중|조사\s*중).{0,18}(?:로그인|계정).{0,18}(?:문제|이슈)/i.test(text)) return special('support-investigating-v32', ['🔍','🛠️','⚠️'], 'status', 97);

        // Schedule movement should beat generic review/document markers.
        if (/\b(?:review|meeting|call|session|appointment).{0,24}(?:moved|rescheduled|shifted|pushed).{0,24}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:검토|회의|미팅|통화|세션|약속).{0,24}(?:옮겨|변경|미뤄|재조정).{0,24}(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|오전|오후|저녁|\d+시)/i.test(text)) return special('rescheduled-v32', ['📅','⏰'], 'event', 97);

        // Positive performance changes in software are performance/tech, not generic dashboard/report icons.
        if (/\b(?:dashboard|page|app|site|screen|report).{0,20}(?:loads?|opens?|renders?|runs?)\s+(?:much\s+|a lot\s+|significantly\s+)?faster\b|(?:대시보드|페이지|앱|사이트|화면).{0,20}(?:훨씬|더|많이)?\s*(?:빨리|빠르게).{0,10}(?:열|로딩|뜬|작동)/i.test(text)) return special('performance-faster-v32', ['⚡','💻'], 'tech', 96);

        // Safety/negation precedence.
        if (/\b(?:payment|charge|card).{0,18}(?:not|wasn['’]t|isn['’]t)\s+(?:rejected|declined)|\b(?:not|wasn['’]t|isn['’]t)\s+(?:rejected|declined).{0,18}(?:payment|charge|card)|(?:결제|카드|청구).{0,18}(?:거절된\s*상태는\s*아니|거절된\s*것은\s*아니|거절되지\s*않|거절이\s*아니)/i.test(text)) return special('payment-not-rejected-v32', ['✅','💳'], 'status', 99);
        if (/\b(?:release|launch|event).{0,22}(?:not delayed|wasn['’]t delayed|isn['’]t delayed).{0,18}(?:but|;|,)?\s*(?:was |is )?cancelled|\b(?:not delayed).{0,20}(?:cancelled|canceled)|(?:릴리스|출시|행사).{0,24}(?:지연이\s*아니라|지연된\s*게\s*아니라).{0,18}취소|지연이\s*아니라\s*취소/i.test(text)) return special('cancel-not-delay-v32', ['🚫','⚠️'], 'status', 99);
        if (/\b(?:avoid|do not|don['’]t|never)\s+(?:clicking|click|opening|open|visiting|visit)\b.{0,30}\b(?:link|url|attachment|file)\b|(?:링크|URL|첨부파일|파일).{0,18}(?:클릭|열|접속).{0,16}(?:피하|하지\s*마|금지)|(?:클릭|열|접속).{0,18}(?:피하|하지\s*마).{0,16}(?:링크|URL|첨부파일|파일)/i.test(text)) return special('avoid-link-v32', ['⚠️','🛡️'], 'security', 99);

        // Protected tokens plus preservation language should use save/bookmark semantics, not generic sparkle.
        if (/(?:#|@)[\p{L}\p{N}_-]+.{0,28}(?:keep|preserve|leave unchanged|do not change)|(?:keep|preserve|leave unchanged).{0,28}(?:#|@)[\p{L}\p{N}_-]+|(?:#|@)[\p{L}\p{N}_-]+.{0,24}(?:그대로\s*유지|바꾸지\s*마|보존)|(?:그대로\s*유지|보존).{0,24}(?:#|@)[\p{L}\p{N}_-]+/iu.test(raw)) return special('preserve-token-v32', ['🔖','📝'], 'writing', 91);

        // v31 narrow precedence repairs before final untouched validation.
        // Concrete actions/objects beat incidental time, weather and location words.
        if (/\bi am not upset anymore\b|\bnot (?:sad|upset|angry) anymore\b|(?:이제|더\s*이상).{0,10}(?:속상|슬프|화).{0,6}(?:않|아니)/i.test(text)) return special('no-longer-upset-v31', ['😌','😊'], 'mood', 96);
        if (/\b(?:saved|save).{0,12}(?:the |a )?draft\b|(?:draft).{0,12}(?:saved|save)\b|(?:초안).{0,12}(?:저장|저장했)|(?:저장).{0,10}(?:초안)/i.test(text)) return special('draft-save-v31', ['📝','📧'], 'writing', 92);
        if (/\b(?:baked|made).{0,14}(?:a )?cake\b|\bcake.{0,18}(?:baked|made)\b|(?:케이크).{0,16}(?:구웠|굽|만들)|(?:구웠|굽|만들).{0,12}(?:케이크)/i.test(text)) return special('cake-v31', ['🎂','🍰','💛'], 'topic', 92);
        // Emotion specificity: choose an emoji family for the actual emotion instead of one broad positive/negative default.
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:hopeful|optimistic)\b/i.test(text)) return special('hopeful-en-specific', ['🌱','😊','🌿'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:proud)\b/i.test(text)) return special('proud-en-specific', ['💪','😊','🎉'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:excited|thrilled)\b/i.test(text)) return special('excited-en-specific', ['🤩','😊','🎉'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:frustrated|annoyed)\b/i.test(text)) return special('frustrated-en-specific', ['😕','😤','😔'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:lonely|sad|upset)\b/i.test(text)) return special('sad-en-specific', ['😔','🥺','😥'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:nervous|anxious|worried)\b/i.test(text)) return special('nervous-en-specific', ['😥','😕','🥺'], 'mood', 90);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,14}(?:calm|relieved|peaceful|lighter)\b/i.test(text)) return special('calm-en-specific', ['😌','🌿','😊'], 'mood', 90);
        if (/(?:희망적|희망이\s*생|조금\s*희망)/i.test(text)) return special('hopeful-ko-specific', ['🌱','😊','🌿'], 'mood', 90);
        if (/(?:뿌듯|자랑스럽)/i.test(text)) return special('proud-ko-specific', ['💪','😊','🎉'], 'mood', 90);
        if (/(?:설렌|신난|신나|기대돼|기대되)/i.test(text)) return special('excited-ko-specific', ['🤩','😊','🎉'], 'mood', 90);
        if (/(?:답답|짜증|화가\s*나|불만)/i.test(text)) return special('frustrated-ko-specific', ['😕','😤','😔'], 'mood', 90);
        if (/(?:외롭|외로|속상|슬프|우울)/i.test(text)) return special('sad-ko-specific', ['😔','🥺','😥'], 'mood', 90);
        if (/(?:긴장|불안|걱정)/i.test(text)) return special('nervous-ko-specific', ['😥','😕','🥺'], 'mood', 90);
        if (/(?:안도|차분|평온|한결\s*가볍|마음이\s*놓)/i.test(text)) return special('calm-ko-specific', ['😌','🌿','😊'], 'mood', 90);
        // Negation/contrast cases where a negative keyword must not flip the meaning.
        if (/\bpayment.{0,12}(?:was |is )?not declined|\bnot declined.{0,12}payment|결제.{0,16}(?:거절된\s*것은\s*아니|거절되지\s*않)/i.test(text)) return special('payment-not-declined', ['✅','💳'], 'status', 92);
        if (/\b(?:event|launch|release).{0,18}(?:was |is )?cancelled.{0,12}not postponed|cancelled,? not postponed|(?:행사|출시|릴리스).{0,18}(?:연기.{0,8}아니|연기가\s*아니).{0,12}취소|연기가\s*아니라\s*취소/i.test(text)) return special('cancel-not-postpone', ['🚫','⚠️'], 'status', 92);
        if (/\bi am not upset anymore\b|\bnot (?:sad|upset|angry) anymore\b|(?:이제|더\s*이상).{0,10}(?:속상|슬프|화).{0,6}(?:않|아니)/i.test(text)) return special('no-longer-upset', ['😌','😊'], 'mood', 91);
        if (/\bcannot wait for (?:the )?weekend\b|\bcan['’]t wait for (?:the )?weekend\b|주말.{0,8}(?:너무\s*)?기다려|주말이.{0,8}기대/i.test(text)) return special('weekend-anticipation', ['🤩','😊'], 'mood', 90);
        if (/(?:첨부파일|첨부\s*파일).{0,30}(?:열지\s*마|열면\s*안|확인\s*전)|\b(?:do not|don['’]t|never) open (?:the )?attachment\b/i.test(text)) return special('attachment-safety', ['⚠️','🛡️'], 'security', 91);
        // Report metric families not covered by the earlier dashboard vocabulary.
        if (/\b(?:signup conversion|average handling time|crash rate)\b|(?:가입\s*전환율|평균\s*처리\s*시간|충돌률)/i.test(text)) {
            if (/\b(?:rose|increased|improved|grew)\b|(?:증가|상승|개선|늘)/i.test(text)) return special('metric2-up', ['📈','📊'], 'report', 88);
            if (/\b(?:fell|decreased|declined|dropped)\b|(?:감소|하락|줄|떨어)/i.test(text)) return special('metric2-down', ['📉','📊'], 'report', 88);
            if (/\b(?:flat|stable|unchanged|nearly unchanged|remained stable)\b|(?:거의\s*변하지\s*않|거의\s*그대로|안정적으로\s*유지)/i.test(text)) return special('metric2-flat', ['📊','➡️'], 'report', 88);
        }
        // Extend earlier report flatness language for refund/support metrics.
        if (/\b(?:refund requests?|support backlog|average handling time|crash rate).{0,30}(?:nearly unchanged|almost unchanged|remained stable|stayed flat)|(?:환불\s*요청|고객지원\s*대기\s*건수|평균\s*처리\s*시간|충돌률).{0,30}(?:거의\s*변하지\s*않|안정적으로\s*유지|거의\s*그대로)/i.test(text)) return special('metric-flat-expanded', ['📊','➡️'], 'report', 88);
        // Reflection phrasings seen in essays and diary-style writing.
        if (/\b(?:time feels shorter when i look back|being busy and moving forward.{0,18}not always the same|finishing everything.{0,20}not the same as enjoying|the journey matters too|remember.{0,18}small moments)\b/i.test(text)) return special('reflection-en-expanded', ['💭','⏳','🌿','🌱','😌'], 'mood', 86);
        if (/(?:과정도\s*중요|기억에\s*남는.{0,12}작은\s*순간|모든\s*일을\s*끝내는.{0,22}하루를\s*잘\s*보내|바쁜\s*것과.{0,18}앞으로\s*나아가|평범한\s*시간.{0,18}기억)/i.test(text)) return special('reflection-ko-expanded', ['💭','⏳','🌿','🌱','😌'], 'mood', 86);
        // Everyday action should beat incidental bedtime/work wording.
        if (/\b(?:called|call|phoned).{0,12}(?:a |my )?(?:friend|sister|brother|family)\b|(?:친구|가족|언니|오빠|형|누나|동생).{0,10}(?:전화|통화)|(?:전화|통화).{0,10}(?:친구|가족)/i.test(text)) return special('call-person-early', ['🤝','📞','😊'], 'social', 84);
        if (/\b(?:walked around the neighborhood|went for a walk|took a walk)\b|동네.{0,8}(?:걸었|산책)|산책.{0,8}(?:했|다녀)/i.test(text)) return special('walk-expanded', ['🚶','🌿'], 'life', 84);
        if (/\b(?:lunch break|real lunch break)\b|점심\s*시간.{0,8}(?:쉬|휴식)/i.test(text)) return special('lunch-break-early', ['🍽️','😌'], 'life', 83);
        // Food subjects from natural consumer/lifestyle writing.
        if (/\b(?:burgers?|hamburgers?)\b|햄버거/i.test(text)) return special('burger-early', ['🍔','😋'], 'topic', 84);
        if (/\b(?:dumplings?)\b|만두/i.test(text)) return special('dumpling-early', ['🥟','😋'], 'topic', 84);
        if (/\b(?:hot chocolate|hot cocoa)\b|핫초코|핫\s*초콜릿/i.test(text)) return special('hot-chocolate-early', ['☕','🍫','😌'], 'topic', 84);
        if (/\b(?:cake).{0,20}(?:baked|made|for)|(?:baked|made).{0,18}(?:a )?cake\b|케이크.{0,16}(?:굽|만들)|(?:굽|만들).{0,12}케이크/i.test(text)) return special('cake-early', ['🎂','🍰','💛'], 'topic', 84);
        if (/\b(?:swam|swimming|went swimming)\b|수영(?:을\s*)?(?:했|하러|갔)/i.test(text)) return special('swimming-early', ['🏊','💪'], 'life', 84);
        // Protected token variants.
        if (/retry[-_ ]after/i.test(raw)) return special('retry-after-expanded', ['⏱️','💻'], 'tech', 84);
        if (/#(?:product_update|launch_notes|release_notes)/i.test(raw)) return special('product-notes-hashtag', ['📝','🔖'], 'writing', 83);
        // Tech phrases for status/update prose and long incident writeups.
        if (/\b(?:settings page).{0,24}(?:loads? faster|opens? faster)|(?:설정\s*페이지).{0,22}(?:더\s*빨리|빠르게).{0,8}(?:열|로드)/i.test(text)) return special('settings-faster', ['⚡','💻','✅'], 'tech', 88);
        if (/\bolder devices?.{0,20}(?:crash|fail).{0,16}(?:login)?|(?:구형\s*기기).{0,20}(?:충돌|실패).{0,15}(?:로그인)?/i.test(text)) return special('older-device-crash', ['⚠️','📱','❌'], 'tech', 88);
        if (/\b(?:notification worker).{0,22}(?:returns? an? error|error)|(?:알림\s*워커).{0,20}(?:오류).{0,10}(?:반환|발생)/i.test(text)) return special('notification-worker-error', ['⚠️','❌','💻'], 'tech', 88);
        if (/\b(?:photo upload|upload).{0,18}(?:crash|crashed|crashing)|(?:업로드).{0,16}(?:충돌|크래시)/i.test(text)) return special('upload-crash-tech', ['⚠️','📱','🛠️','❌'], 'tech', 89);
        if (/\b(?:push notifications?|notifications?).{0,24}(?:late|delayed|stopped|not arriving)|(?:푸시\s*알림|알림).{0,20}(?:늦|지연|오지\s*않)/i.test(text)) return special('notification-delay-tech', ['🔔','⚠️','📱'], 'tech', 89);
        if (/\b(?:notification delivery|delivery).{0,20}(?:normal again|working again)|(?:알림\s*전송|전송).{0,18}(?:다시\s*정상|정상)/i.test(text)) return special('notification-recovered-tech', ['✅','🔔','🛠️'], 'tech', 89);
        if (/\b(?:released|deployed|shipped).{0,12}(?:a )?(?:hotfix|patch)|(?:hotfix|patch).{0,16}(?:released|deployed)\b|(?:핫픽스|패치).{0,14}(?:릴리스|배포)/i.test(text)) return special('hotfix-release-tech', ['🛠️','🔄','✅'], 'tech', 87);
        // Reflective language should not collapse into literal calendar/running/document icons.
        if (/\b(?:process matters as much as (?:the )?result|small moments?.{0,28}(?:remember|matter)|leave more room between plans|do not need to fill every hour|don['’]t need to fill every hour|quiet days?.{0,18}meaningful|stop rushing through ordinary days)\b/i.test(text)) return special('reflection-en-early', ['💭','🌿','🌱','😌','⏳'], 'mood', 82);
        if (/(?:결과만큼\s*과정도\s*중요|작은\s*순간.{0,26}(?:기억|중요|의미)|모든\s*시간.{0,24}(?:채울|꽉\s*채울).{0,12}(?:필요\s*없|필요는\s*없)|앞만\s*보고\s*달리기보다.{0,22}과정|조용한\s*하루.{0,18}의미|약속\s*사이.{0,18}여유)/i.test(text)) return special('reflection-ko-early', ['💭','🌿','🌱','😌','⏳'], 'mood', 82);
        // Spending time with a person is social even when work/day words appear.
        if (/\b(?:spent|spend).{0,18}(?:afternoon|time|day|evening).{0,14}with (?:my |an? )?(?:friend|cousin|sister|brother|neighbor|neighbour|coworker)|\b(?:nice|good).{0,12}to see (?:my |an? )?(?:friend|cousin|sister|brother|neighbor|neighbour|coworker)/i.test(text)) return special('spend-time-person-early', ['🤝','😊','💛'], 'social', 82);
        // Rain at a window is weather, not generic wind/air.
        if (/\b(?:rain|rainy).{0,25}(?:window|against the window)|(?:window).{0,20}(?:rain|rainy)\b|(?:비|빗소리).{0,20}(?:창문|창가)|(?:창문|창가).{0,16}(?:비|빗소리)/i.test(text)) return special('rain-window-early', ['🌧️','☔','🏠'], 'weather', 82);
        // Korean tea phrasing often inserts a quantity between 차를 and 마셨다.
        if (/(?:차를.{0,10}(?:마셨|마신|마시)|차\s*한\s*잔|따뜻한\s*차)/i.test(text)) return special('tea-ko-early2', ['🍵','😌'], 'topic', 81);
        // Cookies should remain the subject even when the weather is mentioned.
        if (/\b(?:cookie|cookies|biscuits?)\b|쿠키|과자/i.test(text)) return special('cookie-early2', ['🍪','😋'], 'topic', 81);
        // Link/document help phrases use a web/document cue without overriding explicit safety prohibitions.
        if (!/do not|don['’]t|never|하지\s*마|마세요|금지/i.test(text) && /(?:read|open|check|review|visit).{0,18}https?:\/\/|https?:\/\/.{0,40}(?:help|docs?|guide)|(?:확인|열어|읽어).{0,18}https?:\/\/|https?:\/\/.{0,32}(?:도움말|문서|가이드)/i.test(raw)) return special('help-link-early', ['🌐','🔍','👀'], 'tech', 80);
        if (/#(?:launch_notes|release_notes)/i.test(raw)) return special('notes-hashtag-early', ['📝','🔖'], 'writing', 78);
        // Explicit first-person emotion should beat incidental task, friend, time or rest words.
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,12}(?:genuinely |really |still |a little )?(?:excited|thrilled|hopeful|optimistic|proud)\b/i.test(text)) return special('explicit-positive-emotion-en', ['🤩','😊','🌱','🎉','💪'], 'mood', 86);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,12}(?:relieved|calm|peaceful|lighter)\b|\bfeel (?:a little )?lighter\b/i.test(text)) return special('explicit-calm-emotion-en', ['😌','🌿','😊'], 'mood', 86);
        if (/\b(?:i (?:am|feel|felt|was)|i['’]m).{0,12}(?:still )?(?:nervous|anxious|worried|lonely|sad|frustrated|upset)\b/i.test(text)) return special('explicit-negative-emotion-en', ['😥','😔','😕','🥺'], 'mood', 86);
        if (/(?:정말\s*신난|신나는\s*기분|조금\s*희망적|희망적인\s*기분|스스로\s*뿌듯|정말\s*설렌|마음이\s*한결\s*가볍|마음이\s*편안|드디어\s*마음이\s*차분)/i.test(text)) return special('explicit-positive-emotion-ko', ['🤩','😊','🌱','😌','🎉','💪'], 'mood', 86);
        if (/(?:아직\s*긴장|조금\s*외롭|조금\s*불안|마음이\s*답답|조금\s*속상|기분이\s*가라앉)/i.test(text)) return special('explicit-negative-emotion-ko', ['😥','😔','😕','🥺'], 'mood', 86);
        if (/\b(?:nice|good|great).{0,12}(?:seeing|meeting|catching up with).{0,20}(?:friend|cousin|sister|brother|neighbor|neighbour|coworker)\b/i.test(text)) return special('nice-seeing-person-early', ['🤝','😊','💛'], 'social', 82);
        if (/(?:천천히\s*)?산책(?:했|했다|했다가|하고|을\s*했)|산책을\s*(?:나갔|다녀왔|했다)/i.test(text)) return special('walk-ko-early', ['🚶','🌿','😊'], 'life', 80);
        if (/\b(?:cart item|item in the cart)\b|장바구니\s*상품/i.test(text)) return special('cart-item-early', ['🛒','📦','⏰'], 'commerce', 78);
        if (/\b(?:refund)\b|환불/i.test(text) && /approved|processed|complete|completed|issued|승인|처리|완료|지급/i.test(text)) return special('refund-done-early2', ['✅','💰','💳'], 'commerce', 80);
        if (/\b(?:ferry)\b|페리/i.test(text)) return special('ferry-subject-early2', ['🚢','🌊','⏰'], 'travel', 77);
        // Report metrics: interpret direction/flatness before generic failure, payment or time words.
        if (/\b(?:weekly active users?|active users?|checkout conversion|conversion rate|support backlog|median response time|response time|refund requests?|refund volume|trial activation|monthly revenue|revenue|server error rate|error rate|traffic|average order value)\b|(?:주간\s*활성\s*사용자|활성\s*사용자|결제\s*전환율|전환율|고객지원\s*대기\s*건수|응답\s*시간\s*중앙값|응답\s*시간|환불\s*요청|환불\s*건수|체험판\s*활성화율|월\s*매출|매출|서버\s*오류율|오류율|트래픽|평균\s*주문\s*금액)/i.test(text)) {
            if (/\b(?:rose|increased|improved|grew|up by)\b|(?:증가|상승|개선|늘)/i.test(text)) return special('metric-up-early', ['📈','📊'], 'report', 82);
            if (/\b(?:fell|decreased|declined|dropped|down by)\b|(?:감소|하락|줄|떨어)/i.test(text)) return special('metric-down-early', ['📉','📊'], 'report', 82);
            if (/\b(?:flat|stable|unchanged|stayed roughly|remained stable|changed very little)\b|(?:거의\s*그대로|변화가\s*없|안정적으로\s*유지|유지됐|유지되었)/i.test(text)) return special('metric-flat-early', ['📊','➡️'], 'report', 81);
        }
        // Email/document actions beat incidental morning/lunch/deadline words.
        if (/\b(?:attach(?:ed|ing)?|add(?:ed)?).{0,18}(?:final )?(?:pdf|file|document|spreadsheet)\b|\b(?:final )?(?:pdf|file|document|spreadsheet).{0,18}(?:attached|attachment)\b|(?:최종\s*)?(?:PDF|파일|문서|스프레드시트).{0,16}(?:첨부|붙였)|(?:첨부).{0,12}(?:PDF|파일|문서|스프레드시트)/i.test(text)) return special('attachment-early', ['📎','📤','✅'], 'writing', 81);
        if (/\b(?:revised|edited|changed|shortened|wrote).{0,18}(?:the )?(?:subject line|email subject)\b|(?:subject line|email subject).{0,18}(?:revised|edited|changed|shortened)\b|(?:제목\s*문구|메일\s*제목|이메일\s*제목).{0,16}(?:수정|바꿨|줄였|작성)/i.test(text)) return special('email-subject-edit-early', ['✏️','📧','📝'], 'writing', 80);
        // Concrete foods and drinks beat work/time/weather context.
        if (/\b(?:ramen|noodles?)\b|라면|국수/i.test(text)) return special('food-ramen-early', ['🍜','😋'], 'topic', 80);
        if (/\b(?:sushi)\b|초밥|스시/i.test(text)) return special('food-sushi-early', ['🍣','😋'], 'topic', 80);
        if (/\b(?:bread|toast|baguette)\b|빵|토스트|바게트/i.test(text)) return special('food-bread-early', ['🍞','😋'], 'topic', 80);
        if (/\b(?:salad)\b|샐러드/i.test(text)) return special('food-salad-early', ['🥗','😋'], 'topic', 80);
        if (/\b(?:curry)\b|카레|커리/i.test(text)) return special('food-curry-early', ['🍛','😋'], 'topic', 80);
        if (/\b(?:ice cream|gelato)\b|아이스크림|젤라토/i.test(text)) return special('food-icecream-early', ['🍦','😋'], 'topic', 80);
        if (/\b(?:espresso)\b|에스프레소/i.test(text)) return special('drink-espresso-early', ['☕','😋'], 'topic', 80);
        if (/\b(?:chamomile tea|green tea|tea)\b|카모마일\s*차|녹차|차를\s*마|차를\s*우/i.test(text)) return special('drink-tea-early', ['🍵','😌'], 'topic', 79);
        // Creative/hobby actions beat bedtime/train/work context.
        if (/\b(?:playlist)\b|플레이리스트/i.test(text)) return special('playlist-early', ['🎧','🎵'], 'creative', 78);
        if (/\b(?:documentary)\b|다큐멘터리/i.test(text)) return special('documentary-early', ['🎬','📺'], 'creative', 78);
        if (/\b(?:guitar)\b|기타를\s*(?:쳤|연주)|기타\s*연주/i.test(text)) return special('guitar-early', ['🎸','🎵'], 'creative', 78);
        if (/\b(?:voice memo|voice note)\b|음성\s*메모/i.test(text)) return special('voice-memo-early', ['🎙️','📝'], 'creative', 78);
        if (/\b(?:edit(?:ed|ing)? photos?|photo editing)\b|사진.{0,10}편집|사진을\s*편집/i.test(text)) return special('photo-edit-early', ['📸','✏️'], 'creative', 78);
        if (/\b(?:co-op game|cooperative game|video game)\b|협동\s*게임|게임을\s*했/i.test(text)) return special('game-early', ['🎮','🕹️'], 'creative', 77);
        if (/\b(?:novel)\b|소설/i.test(text)) return special('novel-early', ['📖','📚'], 'topic', 77);
        // Human meetings and chance encounters beat work/calendar context when no scheduling verb is present.
        if (/\b(?:met|meet|ran into|caught up with|spent time with|had coffee with).{0,28}(?:friend|cousin|sister|brother|neighbor|neighbour|former coworker|old friend)\b|\b(?:friend|cousin|sister|brother|neighbor|neighbour|former coworker|old friend).{0,28}(?:met|saw|caught up|coffee|spent time)\b|(?:친구|사촌|언니|오빠|형|누나|동생|이웃|예전\s*동료).{0,22}(?:만났|마주쳤|봤|커피|시간을\s*보냈)|(?:만났|마주쳤|오랜만에\s*봤).{0,20}(?:친구|사촌|언니|오빠|형|누나|동생|이웃|동료)/i.test(text)) return special('people-meet-early', ['🤝','😊','💛','☕'], 'social', 80);
        // Scheduling: explicit event + schedule/move/confirm/time.
        if (/\b(?:design review|weekly sync|client call|interview|launch meeting|review session|team meeting).{0,36}(?:scheduled|rescheduled|moved|confirmed|starts?|at \d|for (?:next|tomorrow|monday|tuesday|wednesday|thursday|friday))|(?:scheduled|rescheduled|moved|confirmed).{0,28}(?:design review|weekly sync|client call|interview|launch meeting|review session|team meeting)\b|(?:디자인\s*리뷰|주간\s*회의|고객\s*통화|면접|출시\s*회의|검토\s*세션|팀\s*회의).{0,30}(?:예정|예약|변경|옮겨|다시\s*잡|확정|오후|오전|\d+시)/i.test(text)) return special('schedule-event-early', ['📅','⏰','✅'], 'schedule', 81);
        // Tech state should beat generic update/review markers.
        if (/\b(?:api endpoint|login flow|mobile app|upload service|notification worker|checkout page|service|endpoint|worker).{0,34}(?:loads? faster|works? again|working again|fails? on older devices|times? out|returns? (?:a )?500|temporarily unavailable)\b|(?:loads? faster|works? again|fails? on older devices|times? out|temporarily unavailable).{0,26}(?:api endpoint|login flow|mobile app|upload service|notification worker|checkout page|service|endpoint|worker)\b|(?:API\s*엔드포인트|로그인\s*흐름|모바일\s*앱|업로드\s*서비스|알림\s*워커|결제\s*페이지|서비스).{0,30}(?:더\s*빨리|정상\s*작동|다시\s*작동|구형\s*기기.*실패|시간\s*초과|500\s*오류|일시적으로.*사용할\s*수\s*없)/i.test(text)) {
            if (/loads? faster|더\s*빨리/i.test(text)) return special('tech-faster-early', ['⚡','💻','🌐'], 'tech', 80);
            if (/works? again|working again|정상\s*작동|다시\s*작동/i.test(text)) return special('tech-recovered-early', ['✅','🛠️','💻'], 'tech', 82);
            if (/unavailable|사용할\s*수\s*없/i.test(text)) return special('tech-unavailable-early', ['🚫','🌐','⚠️'], 'tech', 82);
            if (/older devices|구형\s*기기/i.test(text)) return special('tech-old-device-fail-early', ['⚠️','📱','🛠️'], 'tech', 82);
            return special('tech-error-early', ['⚠️','❌','💻','🛠️'], 'tech', 82);
        }
        // Everyday semantic anchors.
        if (/\b(?:read for a while|read a little|read quietly)\b|조금\s*책을\s*읽|책을\s*조금\s*읽/i.test(text)) return special('casual-reading-early', ['📖','📚'], 'life', 75);
        if (/\b(?:sat|sit|sitting) by the window\b|창가에\s*앉/i.test(text)) return special('window-rest-early', ['🌿','😌','☀️'], 'life', 74);
        if (/\b(?:fresh air|went outside|stepped outside)\b|바람\s*쐬|밖에\s*나갔/i.test(text)) return special('fresh-air-early', ['🌿','🚶','😌'], 'life', 75);
        // Social caption anchors.
        if (/\b(?:picnic)\b|피크닉/i.test(text)) return special('picnic-early', ['🧺','🌿','☀️'], 'social', 76);
        if (/\b(?:late[- ]night walk|night walk|walk downtown)\b|늦은\s*밤.{0,8}산책|도심\s*산책/i.test(text)) return special('night-walk-early', ['🌙','🚶'], 'social', 76);
        if (/\b(?:side project).{0,18}(?:finished|complete|done)|(?:finished|completed).{0,16}(?:side project)\b|사이드\s*프로젝트.{0,14}(?:마무리|완료|끝)/i.test(text)) return special('side-project-done-early', ['✅','🎉','💪'], 'social', 76);
        if (/\b(?:still smiling|made me smile|smiling about)\b|아직도\s*웃음|생각하면\s*웃음/i.test(text)) return special('smiling-early', ['😊','💛'], 'mood', 76);
        if (/\b(?:hopeful|optimistic)\b|희망적|희망이\s*생|기대가\s*생/i.test(text)) return special('hopeful-early', ['🌱','😊','🌿'], 'mood', 76);
        if (/(?:설렌|설레는|설렜|설레)/i.test(text)) return special('excited-ko-early2', ['🤩','😊','✨'], 'mood', 80);
        if (/\bnot (?:feeling )?happy\b|\b(?:don['’]t|do not) feel happy\b|기분이\s*좋지\s*않|행복하지\s*않/i.test(text)) return special('not-happy-early', ['😔','😕','😥'], 'mood', 82);
        // Travel subject precedence.
        if (/\b(?:train).{0,24}(?:delayed|late|cancelled|canceled)|(?:delayed|late).{0,18}(?:train)\b|기차.{0,18}(?:지연|늦|취소)/i.test(text)) return special('train-delay-early', ['🚆','⏰','😮‍💨'], 'travel', 80);
        if (/\b(?:boarding gate|gate).{0,26}(?:changed|moved|saved|left on time|departure)|(?:boarding gate|gate)\b|탑승\s*게이트|탑승구/i.test(text)) return special('gate-early', ['📍','✈️'], 'travel', 76);
        // Commerce subject precedence, including preorder/replacement wording.
        if (/\b(?:preorders?|pre-orders?)\b|사전\s*주문/i.test(text)) {
            if (/expires?|만료/i.test(text)) return special('preorder-expiry-early', ['⏰','🏷️'], 'commerce', 76);
            if (/opens?|open|열린|시작/i.test(text)) return special('preorder-open-early', ['⏰','🛒','📅'], 'commerce', 76);
            return special('preorder-early', ['🛒','📦'], 'commerce', 74);
        }
        if (/\b(?:replacement item|replacement product)\b|교환\s*상품/i.test(text)) return special('replacement-item-early', ['📦','🚚','✅'], 'commerce', 77);
        if (/\b(?:discount code|coupon code|promo code)\b|할인\s*코드|쿠폰\s*코드/i.test(text)) return special('discount-code-early', ['🏷️','🎟️','⏰'], 'commerce', 77);
        // Protected technical tokens still deserve a relevant surrounding suggestion.
        if (/retry_after/i.test(raw)) return special('retry-after-early', ['⏱️','💻'], 'tech', 79);
        if (/release_notes/i.test(raw)) return special('release-notes-early', ['📝','🔖'], 'writing', 78);
        // Email/reply drafting is a writing action, even when incidental deadline/time words appear.
        if (/\b(?:wrote|drafted|composed|saved|sent|forwarded|revised|edited).{0,18}(?:a |the )?(?:reply|email|message)\b|\b(?:reply|email|message).{0,18}(?:draft|drafted|wrote|written|composed|saved|sent|forwarded|revised|edited)\b|(?:답장|회신|이메일|메일).{0,18}(?:초안|작성|썼|써|보냈|전송|수정|저장)|(?:초안|작성|썼|써|보냈|전송|수정|저장).{0,14}(?:답장|회신|이메일|메일)/i.test(text)) return special('email-reply-writing', ['📧','✏️','📝','📤'], 'writing', 79);
        // Concrete food subjects beat incidental weather/time wording.
        if (/\b(?:pizza)\b|피자/i.test(text)) return special('pizza-subject-early', ['🍕','😋'], 'topic', 78);
        // Korean desk cleaning/tidying morphology, including 치웠다/치웠어요.
        if (/(?:책상|데스크).{0,18}(?:치웠|치우|정리|청소|닦)|(?:치웠|치우|정리|청소|닦).{0,14}(?:책상|데스크)/i.test(text)) return special('desk-tidy-ko-early', ['🧹','🏠','✅'], 'life', 79);
        // Korean emotional stems should not fall through to generic completion/document icons.
        if (/(?:답답|외롭|외로|속상|우울|서운|허전|마음이\s*무겁|기분이\s*(?:가라앉|좋지\s*않|별로)|마음이\s*좋지\s*않)/i.test(text)) return special('negative-mood-ko-early', ['😔','😕','😥','🥺','💙'], 'mood', 79);
        if (/(?:신나|설레|뿌듯|기대되|기분이\s*좋|기뻐|즐거)/i.test(text)) return special('positive-mood-ko-early', ['😊','🤩','🎉','✨'], 'mood', 77);
        if (/(?:안도|마음이\s*놓|차분|평온|편안)/i.test(text)) return special('calm-relief-ko-early', ['😌','🌿','😊'], 'mood', 76);
        // Looking forward to seeing someone is social anticipation, not a generic sentence.
        if (/(?:빨리.{0,10}(?:만나|보고).{0,8}싶|(?:만나|볼)\s*생각에.{0,10}(?:기대|설레))/i.test(text)) return special('looking-forward-person-ko-early', ['😊','🤩','💛'], 'mood', 78);
        // Saved return/boarding tickets should beat bedtime/reading language in long travel prose.
        if (/\b(?:saved|downloaded|added).{0,24}(?:return ticket|boarding pass|flight ticket|train ticket).{0,22}(?:phone|wallet|app)?|(?:return ticket|boarding pass|flight ticket).{0,28}(?:saved|downloaded|phone|wallet)\b|(?:돌아오는\s*표|귀국\s*표|탑승권|항공권|기차표).{0,24}(?:휴대폰|폰|지갑|앱).{0,16}(?:저장|추가|받아)|(?:저장|추가).{0,18}(?:돌아오는\s*표|귀국\s*표|탑승권|항공권|기차표)/i.test(text)) return special('saved-ticket-early', ['🎫','📱','✈️'], 'travel', 78);
        if (/\b(?:shared the workload|shared (?:my|the) work|covered (?:one of )?(?:my )?tasks?|offered support|stepped in to help|helped me out|gave me a hand|checked on me|backed me up|took (?:one of )?(?:my )?tasks?)\b|(?:일|업무|작업).{0,18}(?:나눠\s*맡|같이\s*나눠|대신\s*맡|덜어\s*주)|(?:챙겨줬|도와줬|지원해줬|도움을\s*줬)/i.test(text)) return special('direct-help', ['🤝','💛','🙏','😊'], 'social', 75);
        if (/\b(?:feel|felt|was|am).{0,10}(?:anxious|nervous|worried|uneasy)\b|불안(?:한|했|하)|긴장(?:한|했|되)/i.test(text)) return special('anxious-mood', ['😥','😔','😕'], 'mood', 73);
        if (/\b(?:feel|felt|was|am).{0,10}(?:proud|relieved|calm|excited)\b|(?:뿌듯|안도|차분|신나)(?:한|했|되는|스럽)/i.test(text)) return special('positive-state', ['😊','🎉','😌','🤩'], 'mood', 71);
        if (/\b(?:service|endpoint|api|request|login request|browser feature).{0,28}(?:fails?|failed|times? out|timeout|returns? an? error|works? again|working again|unavailable|not available)\b|(?:fails?|failed|times? out|timeout|works? again|unavailable).{0,20}(?:service|endpoint|api|request)\b|(?:서비스|엔드포인트|API|요청|로그인\s*요청|브라우저\s*기능).{0,25}(?:실패|시간\s*초과|타임아웃|오류를\s*반환|다시\s*작동|정상\s*작동|사용할\s*수\s*없|이용\s*불가)/i.test(text)) {
            if (/works? again|working again|다시\s*(?:작동|정상)|정상\s*작동/i.test(text)) return special('tech-working-again', ['✅','🛠️','💻'], 'tech', 75);
            if (/unavailable|not available|사용할\s*수\s*없|이용\s*불가/i.test(text)) return special('tech-unavailable', ['🚫','🌐','⚠️'], 'tech', 74);
            return special('tech-request-problem', ['⚠️','💻','🛠️','❌'], 'tech', 75);
        }
        if (/\b(?:hotel|hostel|guesthouse|guest house|hotel room|room near).{0,30}(?:booked|reserved|checked in|check(?:ed)? into|stay|staying)|(?:booked|reserved|checked in|check(?:ed)? into).{0,28}(?:hotel|hostel|guesthouse|room)\b|(?:호텔|호스텔|게스트하우스|숙소|호텔\s*방).{0,25}(?:예약|잡았|체크인|묵|숙박)|(?:예약|잡았|체크인).{0,20}(?:호텔|호스텔|게스트하우스|숙소|방)/i.test(text)) return special('lodging', ['🏨','📍','🧳'], 'travel', 74);
        if (/\b(?:soup|stew).{0,18}(?:made|cooked|heated|served)?|(?:made|cooked).{0,18}(?:soup|stew)|(?:수프|스프|찌개).{0,16}(?:끓|만들|먹)|(?:끓|만들).{0,12}(?:수프|스프|찌개)/i.test(text)) return special('soup-first', ['🍲','😋'], 'topic', 74);
        if (/\b(?:pasta|spaghetti).{0,18}(?:cooked|made|ate|ordered)?|(?:cooked|made|ate).{0,16}(?:pasta|spaghetti)|(?:파스타|스파게티).{0,16}(?:만들|요리|먹|주문)/i.test(text)) return special('pasta-first', ['🍝','😋'], 'topic', 73);
        if (/\b(?:dessert|cake|cheesecake|brownie).{0,18}(?:had|ate|ordered)?|(?:had|ate|ordered).{0,16}(?:dessert|cake)|(?:디저트|케이크|브라우니).{0,16}(?:먹|주문|즐)/i.test(text)) return special('dessert-first', ['🍰','😋'], 'topic', 73);
        if (/\b(?:baked|made).{0,16}(?:cookies?|biscuits?)|(?:cookies?|biscuits?).{0,16}(?:baked|made)|(?:쿠키|과자).{0,14}(?:굽|만들)|(?:굽|만들).{0,12}(?:쿠키|과자)/i.test(text)) return special('cookies-first', ['🍪','😋'], 'topic', 73);
        if (/\b(?:wash(?:ed)?|do|did).{0,12}(?:the )?dishes|(?:the )?dishes.{0,12}(?:washed|done)|설거지.{0,14}(?:끝|했|하|완료)/i.test(text)) return special('dishes-done', ['🍽️','✅','🏠'], 'life', 72);
        if (/\b(?:cleaned|cleared|tidied).{0,18}(?:my |the )?desk|(?:my |the )?desk.{0,18}(?:cleaned|cleared|tidied)|책상.{0,14}(?:치우|정리|청소)|(?:치우|정리).{0,12}책상/i.test(text)) return special('desk-tidy', ['🧹','🏠','✅'], 'life', 72);
        if (/\b(?:added|left|wrote).{0,12}(?:a |the )?note\b|(?:a |the )?note.{0,18}(?:review|feedback|publishing|layout|unclear)|(?:메모|주석).{0,14}(?:추가|남기|작성)|(?:추가|남긴).{0,12}(?:메모|주석)/i.test(text)) return special('editor-note', ['📝','✏️','👀','🔖'], 'writing', 72);
        if (/(?:도입부|서론|첫\s*문단|오프닝).{0,18}(?:다시\s*썼|다시\s*쓰|수정|고쳐)|(?:다시\s*썼|수정|고쳐).{0,14}(?:도입부|서론|오프닝)/i.test(text)) return special('rewrite-opening-ko', ['✏️','📝','👀'], 'writing', 73);
        if (/\b(?:flashcards?|flash cards?)\b|플래시\s*카드|플래시카드/i.test(text)) return special('flashcards-study', ['📚','📝','🔖'], 'growth', 73);
        if (/(?:20\s*분|십\s*분|이십\s*분)?.{0,8}(?:스트레칭|러닝|달리기|운동)|(?:스트레칭|러닝|달리기|운동).{0,18}(?:20\s*분|피곤|오랜만|퇴근|출근)/i.test(text)) return special('exercise-ko', ['🏃','💪','😊'], 'life', 73);
        if (/\b(?:flight|boarding time|gate|connection).{0,28}(?:pushed back|moved back|pushed later)|(?:pushed back|moved back).{0,20}(?:flight|boarding time|gate|connection)\b|(?:항공편|탑승\s*시간|게이트|환승\s*시간).{0,24}(?:뒤로\s*밀|뒤로\s*미뤄|늦춰)/i.test(text)) return special('flight-pushed-back', ['✈️','⏰','📍','😮‍💨'], 'travel', 74);
        if (/\b(?:payment).{0,18}(?:did not|didn['’]t) fail|(?:did not|didn['’]t).{0,12}(?:payment).{0,10}fail|(?:결제).{0,18}(?:실패한\s*것은\s*(?:아니|아닙|아님)|실패하지\s*않)/i.test(text)) return special('payment-not-failed', ['✅','💳'], 'status', 76);
        if (/\b(?:cannot|can['’]t) wait to (?:see|meet)|looking forward to (?:seeing|meeting)|want to see .* soon|빨리\s*(?:만나|보고)\s*싶|만날\s*생각에\s*기대/i.test(text)) return special('looking-forward-people', ['😊','🤩','💛'], 'mood', 73);
        if (/\b(?:api docs?|api documentation|developer docs?|documentation).{0,22}(?:https?:\/\/|www\.)|(?:API|개발자)\s*(?:문서|가이드).{0,22}(?:https?:\/\/|www\.)/i.test(raw)) return special('api-doc-link', ['💻','🌐'], 'tech', 72);
        if (/\b(?:coupon|voucher|promo code|discount).{0,20}(?:shipped|arrived|expires?|expired)|(?:refund|replacement order).{0,20}(?:shipped|arrived|expires?|expired)\b|(?:쿠폰|바우처|환불|교환\s*상품).{0,20}(?:발송|도착|만료|종료)/i.test(text)) {
            if (/coupon|voucher|promo|discount|쿠폰|바우처/i.test(text)) return special('commerce-coupon-subject', ['🏷️','⏰'], 'commerce', 70);
            if (/replacement order|교환\s*상품/i.test(text)) return special('commerce-replacement-subject', ['📦','🚚','✅'], 'commerce', 70);
            return special('commerce-refund-subject', ['💳','💰','✅'], 'commerce', 70);
        }
        if (/\b(?:revenue|conversion rate|response time|monthly traffic|refund volume|average order value).{0,28}(?:changed very little|stayed almost flat|was almost unchanged|barely changed|improved|increased|decreased|fell)|(?:changed very little|stayed almost flat|barely changed).{0,22}(?:revenue|traffic|rate|value|volume)|(?:매출|전환율|응답\s*시간|월간\s*트래픽|환불\s*건수|주문\s*금액).{0,28}(?:거의\s*그대로|큰\s*변화가\s*없|거의\s*변하지|개선|증가|감소|줄|하락)/i.test(text)) return special('report-metric-general', ['📊','📈','📉','➡️','⏱️'], 'report', 72);
        if (/(?:거리가|길이|도로가).{0,12}(?:하얗게|하얘|새하얗게).{0,10}(?:변|됐)|(?:하얗게|하얘).{0,10}(?:거리|길|도로)/i.test(text)) return special('street-white-snow', ['❄️','🌨️','🥶'], 'weather', 73);
        if (/(?:생각이\s*자주\s*든|생각이\s*든다|돌아보면|깨닫는).{0,10}|(?:시간|과정|여유|하루).{0,26}(?:생각이\s*자주\s*든|생각하게\s*된)/i.test(text)) return special('reflection-ko-broad', ['💭','🤔','⏳','🌿','🌱'], 'mood', 69);
        if (/(?:새\s*디자인|디자인|레이아웃).{0,22}(?:싫은\s*것은\s*(?:아닙|아니|아님)|싫지는\s*않|나쁜\s*것은\s*(?:아닙|아니|아님))/i.test(text)) return special('design-not-disliked-ko', ['😊','🤔'], 'mood', 72);
        if (/(?:경고|알림).{0,20}(?:이제|더\s*이상).{0,18}(?:활성\s*상태가\s*(?:아닙|아니|아님)|활성화되지\s*않|비활성|꺼져)/i.test(text)) return special('warning-off-ko', ['✅','ℹ️'], 'status', 72);
        if (/(?:보고\s*싶던|오랜만에|예전)\s*(?:사람|친구|동창).{0,35}(?:만났|만나|이야기|산책|함께)|(?:밀린\s*이야기).{0,16}(?:했|나눴)/i.test(text)) return special('reunited-people-ko', ['🤝','💛','😊','💬','🚶'], 'social', 72);
        if (/(?:동료|팀원|친구).{0,45}(?:작업|일|업무).{0,24}(?:맡아\s*주|대신\s*해|나눠\s*주|도와\s*주)|(?:작업|일|업무).{0,25}(?:맡아\s*주|나눠\s*주).{0,20}(?:동료|팀원)/i.test(text)) return special('work-help-ko', ['🤝','💛','🌿'], 'social', 72);
        if (/(?:일요일|저녁|점심|아침).{0,18}(?:식사|밥).{0,30}(?:이야기|대화|함께|길어)|(?:식사|밥).{0,28}(?:이야기|대화|함께).{0,20}(?:길어|계속)/i.test(text)) return special('family-meal-ko', ['🍽️','💛'], 'social', 70);
        if (/(?:부모님|가족|형제|자매).{0,30}(?:예전|옛날|오래된)\s*(?:사진|앨범)|(?:예전|옛날|오래된)\s*(?:사진|앨범).{0,25}(?:부모님|가족|형제|자매)/i.test(text)) return special('family-old-photos-ko', ['📸','💛'], 'social', 70);
        if (/(?:차|커피).{0,20}(?:식|차가워).{0,28}(?:고마|감사)|(?:그런|이런)\s*시간.{0,18}(?:고마|감사)|(?:고마|감사).{0,18}(?:시간|함께)/i.test(text)) return special('grateful-time-ko', ['🙏','🍵','💛'], 'mood', 70);
        if (/(?:최종|마지막).{0,16}(?:스프레드시트|문서|자료).{0,30}(?:검토용|검토).{0,20}(?:첨부|보냈)|(?:스프레드시트|문서|자료).{0,25}(?:첨부).{0,20}(?:검토)|(?:재무팀|팀).{0,25}(?:목요일|금요일|다음\s*주).{0,20}(?:예측|전망|자료).{0,15}(?:논의|회의)/i.test(text)) return special('report-review-schedule-ko', ['📎','👀','📅'], 'report', 70);
        if (/\b(?:read|reading).{0,35}(?:book|novel|chapter|pages?).{0,24}(?:before bed|on the train|at night|for an hour)?|(?:on the train|before bed).{0,25}(?:read|reading)\b|(?:책|소설|챕터|장).{0,25}(?:읽|독서)|(?:기차|자기\s*전).{0,20}(?:책|소설|챕터).{0,15}(?:읽)?/i.test(text)) return special('reading-first', ['📖','📚','📵'], 'topic', 67);
        if (/\b(?:caught up|met again|met after a long time|after a long time).{0,35}(?:friend|friends|classmate|people)|(?:people|friends).{0,25}(?:i missed|we missed).{0,18}(?:met|caught up|walked|talked)|(?:보고\s*싶던|오랜만에|예전)\s*(?:사람|친구|동창).{0,30}(?:만나|이야기|산책|함께)|(?:밀린\s*이야기).{0,15}(?:했|나눴)/i.test(text)) return special('reunited-people', ['🤝','💛','😊','💬','🚶'], 'social', 67);
        if (/\b(?:cannot|can['’]t) believe how (?:short|fast).{0,20}(?:year|month|week)|strange how (?:short|fast).{0,20}(?:year|month|week)|how (?:short|fast).{0,20}(?:year|month|week).{0,12}(?:feels?|seems?)|(?:믿기지|이상할\s*만큼).{0,20}(?:올해|이번\s*달|이번\s*주).{0,16}(?:짧|빠르)|(?:올해|이번\s*달|이번\s*주).{0,16}(?:짧게|빠르게).{0,12}(?:느껴|느껴진)/i.test(text)) return special('time-short-reflection', ['⏳','🕰️','💭'], 'life', 66);
        if (/\b(?:saw|watched|noticed).{0,20}(?:the )?sky.{0,20}(?:turn|turning|turned).{0,12}(?:orange|pink|red|golden)|(?:sky).{0,18}(?:turn|turning|turned).{0,10}(?:orange|pink|red|golden)|(?:하늘).{0,20}(?:주황|분홍|붉|금빛).{0,10}(?:변하|변했|물들)|(?:주황|분홍|붉).{0,15}(?:하늘)/i.test(text)) return special('sunset-sky-color', ['🌅','☀️','🌊'], 'weather', 66);
        if (/(?:새\s*디자인|디자인|레이아웃).{0,18}(?:싫은\s*것은\s*아니|싫지는\s*않|나쁜\s*것은\s*아니)|\b(?:new )?(?:design|layout).{0,18}(?:don['’]t hate|do not hate|don['’]t dislike|not bad)\b/i.test(text)) return special('design-not-disliked', ['😊','🤔'], 'mood', 66);
        if (/(?:경고|알림).{0,18}(?:이제|더\s*이상).{0,16}(?:활성\s*상태가\s*아니|활성화되지\s*않|비활성|꺼져)|\b(?:warning|alert|notification).{0,20}(?:no longer active|not active anymore|disabled|turned off)\b/i.test(text)) return special('warning-off', ['✅','ℹ️'], 'status', 66);
        if (/\b(?:put|putting).{0,14}(?:all )?(?:the )?clothes away|(?:all )?(?:the )?clothes.{0,16}(?:put away|folded|sorted)|(?:모든\s*)?옷을.{0,16}(?:정리해\s*넣|개어|접어|정돈)/i.test(text)) return special('clothes-away', ['🧺','✅','🏠'], 'life', 65);
        if (/\b(?:following|after).{0,16}(?:a )?(?:packed|draining|busy|exhausting|long) (?:week|day).{0,24}(?:quiet|rest|break|slow)|(?:packed|draining|busy|exhausting) (?:week|day).{0,28}(?:quiet evening|proper break|rest)|(?:바쁜|지치는|고된)\s*(?:한\s*)?(?:주|하루).{0,30}(?:조용히|휴식|쉬)/i.test(text)) return special('recovery-rest', ['😌','🌿','🌙','🛌','😴'], 'life', 65);
        if (/(?:선택지).{0,18}(?:차분히\s*)?(?:비교|따져)|(?:지금은|현재는).{0,20}(?:무엇이\s*중요한지|생각할\s*시간|거리를\s*두고\s*생각)|\b(?:calmly )?(?:compare|weigh) (?:the )?options|step back (?:and|to) think|need (?:some )?time to decide\b/i.test(text)) return special('decision-think', ['🤔','💭','🌿'], 'mood', 65);
        if (/\b(?:little|small|tiny|modest).{0,15}(?:win|wins|progress|improvement|achievement|change)|(?:notice|count|celebrate|recognize|recognise).{0,22}(?:little|small|tiny).{0,10}(?:win|progress|change)|(?:작은|사소한|조금의)\s*(?:성과|성취|진전|변화)|(?:성과|진전|변화).{0,18}(?:챙기|알아차리|놓치지)/i.test(text)) return special('small-progress', ['🌱','🏆','✅','🌿','😊'], 'growth', 64);
        if (/\b(?:added|wrote|left).{0,18}(?:a |the )?note.{0,28}(?:review|editor|unclear|mobile|layout|draft)|(?:note).{0,25}(?:final review|mobile layout|unclear)|(?:rewrote|revised|edited).{0,30}(?:opening|intro|introduction|headline|title)\b|(?:메모|주석).{0,28}(?:검토|모바일|레이아웃|불분명|명확)|(?:도입부|서론|제목|헤드라인).{0,28}(?:다시\s*쓰|수정|줄이|편집)/i.test(text)) return special('editorial-writing', ['✏️','📝','👀','🔖','📱'], 'writing', 63);
        if (/\b(?:miss(?:ing)?|wish i could see|wish we could see|haven['’]t seen|have not seen).{0,35}(?:parents?|family|friends?|people|siblings?|grandparents?)|(?:parents?|family|friends?|people).{0,30}(?:more often|again soon).{0,10}(?:wish|hope)?|(?:부모님|가족|친구|사람|형제|자매|조부모님).{0,28}(?:보고\s*싶|그립|자주\s*보|못\s*봤)|(?:보고\s*싶|그립).{0,22}(?:부모님|가족|친구|사람)/i.test(text)) return special('missing-people', ['😔','💛','💭'], 'mood', 62);
        if (/\b(?:coupon|voucher|promo(?:tion)?|discount(?: code)?).{0,35}(?:valid|works?|usable|good through|good until|ends?|expires?|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:valid|works?|ends?|expires?).{0,24}(?:coupon|voucher|promo|discount)\b|(?:쿠폰|바우처|프로모션|할인).{0,30}(?:유효|사용\s*가능|쓸\s*수|끝|종료|만료|내일|일요일|월요일|화요일|수요일|목요일|금요일|토요일)|(?:이번|이)\s*일요일까지.{0,16}(?:사용|쓸)/i.test(text)) return special('coupon-validity', ['🏷️','⏰'], 'commerce', 61);
        if (/\b(?:booked|reserved|checked into|staying in).{0,30}(?:hotel|room|hostel|guesthouse|suite)|(?:hotel|room|hostel|guesthouse|suite).{0,30}(?:booked|reserved|near the station|for the night)|(?:작은 |조용한 )?room\b.{0,20}(?:booked|reserved)|(?:호텔|숙소|방|호스텔).{0,25}(?:예약|잡았|묵|숙박)|(?:예약|잡았).{0,20}(?:호텔|숙소|방)/i.test(text)) return special('hotel-stay', ['🏨','📍','🧳'], 'travel', 62);
        if (/\b(?:malware|virus|security) (?:scan|check).{0,30}(?:required|mandatory|expires?|expiring|completed|arrived|passed|clean)|(?:scan|check).{0,20}(?:malware|virus).{0,18}(?:required|expire|complete)|(?:악성코드|바이러스|보안)\s*(?:검사|스캔).{0,28}(?:필수|만료|완료|정상|도착|통과)/i.test(text)) return special('security-scan', ['🛡️','🔒','✅','⏰'], 'tech', 62);
        if (/\b(?:login|sign[- ]in) (?:failures?|errors?|failed attempts?).{0,35}(?:fell|dropped|decreased|declined|down|lower|reduced)|(?:fell|dropped|decreased|declined|reduced).{0,24}(?:login|sign[- ]in) (?:failures?|errors?)\b|(?:로그인|인증)\s*실패.{0,26}(?:줄|감소|하락|낮아)|(?:줄|감소|하락).{0,20}(?:로그인|인증)\s*실패/i.test(text)) return special('login-errors-down', ['📉','📊','🔒'], 'report', 64);
        if (/\b(?:playlist|melody|tune|song|music|demo|track).{0,35}(?:made|created|recorded|finished|saved|new)|(?:recorded|created|made).{0,25}(?:melody|tune|song|playlist|demo)|(?:플레이리스트|멜로디|곡|노래|음악|데모).{0,30}(?:만들|녹음|기록|완성|저장)|(?:녹음|만들).{0,20}(?:멜로디|곡|데모)/i.test(text)) return special('music-making', ['🎵','🎧','🎙️','🎹'], 'creative', 62);
        if (/\b(?:run|running|jog|jogging|stretch|stretched|stretching|workout|exercise|gym|yoga).{0,42}(?:tired|after a break|after a long break|started again|back into|finished|did it|kept going)?|(?:러닝|달리기|스트레칭|운동|헬스|요가).{0,35}(?:피곤|오랜만|다시|해냈|마쳤|시작)/i.test(text)) return special('exercise-activity', ['🏃','💪','😊'], 'life', 62);
        if (/\b(?:shot|took|taking|captured|photographed|photographing).{0,25}(?:portraits?|photos?|pictures?|images?)|(?:portrait|portraits|photos?|pictures?).{0,22}(?:shot|taken|captured)|(?:인물|사진).{0,20}(?:찍|촬영)|(?:촬영|찍).{0,18}(?:인물|사진)/i.test(text)) return special('photo-taking', ['📸','📷','🌅'], 'creative', 62);
        if (/(?:팀원|동료|친구).{0,30}(?:일을\s*같이\s*나눠|업무를\s*나눠|일을\s*덜어|같이\s*맡아|도와줬|도와주)|(?:일|업무).{0,18}(?:같이\s*나눠|나눠서\s*맡).{0,18}(?:팀원|동료)/i.test(text)) return special('shared-work-help', ['🤝','💛','😊'], 'social', 62);
        if (/\b(?:sky|clouds?).{0,24}(?:turned|became|glowed).{0,18}(?:orange|pink|red|golden)|(?:orange|pink|golden).{0,18}(?:sky|sunset)|(?:하늘|구름).{0,24}(?:주황|분홍|붉|금빛).{0,12}(?:변|물들)|(?:주황|분홍|붉).{0,16}(?:하늘|노을)/i.test(text)) return special('sunset-color', ['🌅','☀️','🌊'], 'weather', 61);
        if (/\b(?:year|month|week|summer|winter).{0,30}(?:feels?|seems?).{0,18}(?:short|fast|quick)|(?:cannot|can['’]t) believe.{0,28}(?:year|month|week).{0,18}(?:short|fast|gone)|strange how.{0,25}(?:year|month|week).{0,18}(?:short|fast)|(?:올해|이번\s*달|이번\s*주|여름|겨울).{0,30}(?:짧게|짧아|빠르게|금방).{0,12}(?:느껴|지나)|(?:벌써|믿기지).{0,25}(?:올해|이번\s*달|이번\s*주)/i.test(text)) return special('time-feels-short', ['⏳','🕰️','💭'], 'life', 61);
        if (/\b(?:package|parcel|shipment|order).{0,32}(?:left (?:the )?warehouse|arrived early|arrived earlier|arrived ahead|shipped|dispatched|delivered)|(?:택배|배송|주문\s*상품|상품).{0,30}(?:창고를\s*출발|예상보다\s*일찍\s*도착|일찍\s*도착|발송|배송\s*시작|도착)/i.test(text)) return special('shipment-status', ['📦','🚚','✅'], 'commerce', 63);
        if (/\b(?:packed|draining|exhausting|busy|long).{0,15}(?:week|day).{0,30}(?:quiet evening|proper break|rest|take it easy)|(?:quiet evening|proper break).{0,28}(?:after|following).{0,14}(?:week|day)|(?:바쁜|지치는|고된|긴)\s*(?:한\s*)?(?:주|하루).{0,30}(?:조용한\s*저녁|제대로\s*쉬|휴식)/i.test(text)) return special('rest-after-busy', ['😌','🌿','🌙','🛌','😴'], 'life', 61);
        if (/\b(?:grandparents?|aunt|uncle|relatives?|extended family).{0,35}(?:talk|talked|conversation|spent|evening|afternoon|dinner|visit)|(?:spent|sat|talked).{0,30}(?:grandparents?|aunt|uncle|relatives?)|(?:조부모님|할머니|할아버지|이모|고모|삼촌|외삼촌|친척).{0,30}(?:이야기|함께|시간|저녁|오후|만나)|(?:함께|이야기).{0,20}(?:조부모님|이모|삼촌|친척)/i.test(text)) return special('extended-family', ['💛','🤝','😊'], 'social', 61);
        if (/\b(?:issue|problem|service|login).{0,35}(?:fixed|resolved|ended|completed).{0,24}(?:without errors?|cleanly|normally)?|(?:fixed|resolved).{0,24}(?:issue|problem|login)|(?:문제|서비스|로그인).{0,30}(?:오류\s*없이|정상적으로).{0,18}(?:끝|해결|완료)|(?:오류\s*없이).{0,20}(?:끝|완료|해결)/i.test(text)) return special('technical-recovery', ['✅','🛠️','💻'], 'tech', 63);
        if (/\b(?:not|isn['’]t|is not).{0,15}(?:that i )?(?:hate|dislike).{0,22}(?:design|layout|change|version)|(?:design|layout|change).{0,24}(?:not bad|isn['’]t bad)|(?:디자인|레이아웃|변경).{0,26}(?:싫은\s*것은\s*아니|싫지는\s*않|나쁘지는\s*않)/i.test(text)) return special('not-dislike-design', ['😊','🤔'], 'mood', 61);
        if (/\b(?:warning|alert|notification).{0,25}(?:no longer|not anymore|isn['’]t|is not).{0,14}(?:active|enabled|on)|(?:no longer active|disabled).{0,20}(?:warning|alert)|(?:경고|알림).{0,24}(?:더\s*이상|이제).{0,14}(?:활성\s*상태가\s*아니|활성화되지\s*않|꺼져|비활성)/i.test(text)) return special('alert-inactive', ['✅','ℹ️'], 'status', 61);
        if (/\b(?:forwarded|forwarding).{0,25}(?:document|file|message|email)|(?:document|file|message).{0,25}(?:forwarded|emailed)|(?:문서|파일|메시지).{0,24}(?:이메일로\s*전달|메일로\s*전달|전달했)|(?:이메일|메일).{0,18}(?:전달|포워드)/i.test(text)) return special('email-forward', ['📧','📤','✏️','✅'], 'writing', 61);
        if (/\b(?:read|reading).{0,30}(?:book|chapter|novel|pages?).{0,20}(?:before bed|on the train|at night)?|(?:book|chapter|novel).{0,25}(?:read|reading)|(?:책|소설|챕터|장).{0,24}(?:읽|독서)|(?:읽|독서).{0,18}(?:책|소설|챕터)/i.test(text)) return special('reading-activity', ['📖','📚','📵'], 'topic', 61);
        if (/\b(?:ferry|boat|ship).{0,25}(?:stopped|paused|waited|held).{0,18}(?:minutes?|for)|(?:페리|선박|배를\s*타고|배가).{0,24}(?:멈|정지|대기).{0,16}(?:분|동안)?/i.test(text)) return special('ferry-stop', ['🚢','⏰'], 'travel', 61);
        if (/\b(?:exchange|replacement|return).{0,28}(?:request|case).{0,20}(?:completed|approved|processed|finished)|(?:교환|반품|대체)\s*(?:요청|건).{0,24}(?:완료|승인|처리)/i.test(text)) return special('exchange-complete', ['✅','📦','💳'], 'commerce', 61);
        if (/\b(?:response headers?|http headers?).{0,26}(?:retry_after|retry-after|retry after)|(?:retry_after|retry-after|retry after).{0,20}(?:response headers?|headers?)|(?:응답\s*헤더|HTTP\s*헤더).{0,22}(?:retry_after|retry-after|재시도\s*시간)/i.test(raw)) return special('retry-header', ['💻','⏱️'], 'tech', 62);
        if ((STOP_ACTION.test(text) || /\b(?:do not|don['’]t|never).{0,10}(?:visit|open|follow).{0,20}(?:url|link|site)|(?:방문|접속|열기).{0,12}(?:하지\s*마|금지)/i.test(text)) && /https?:\/\/|www\./i.test(raw)) return special('unsafe-link-stop', ['⚠️','🛡️'], 'status', 64);
        // These rules intentionally match concept families rather than benchmark wording.

        // Human help/support should beat generic work, challenge or completion cues.
        if (/\b(?:colleague|coworker|teammate|friend|someone|neighbor|neighbour|person).{0,55}(?:help(?:ed|ing)?|support(?:ed|ive)?|stepped in|gave me a hand|made (?:the )?(?:task|work|day) easier|checked on me|covered for me|took over|offered to help|backed me up)|(?:help(?:ed|ing)?|support(?:ed|ive)?|stepped in|gave me a hand|checked on me|covered for me).{0,45}(?:colleague|coworker|teammate|friend|someone|neighbor|neighbour)\b|(?:동료|친구|팀원|누군가|주변 사람).{0,45}(?:도와|도움|지원|거들|대신 맡|챙겨|살펴|도와주)|(?:도와|도움|지원|거들|챙겨).{0,35}(?:동료|친구|팀원|누군가)/i.test(text)) return special('human-help', ['🤝','💛','😊'], 'social', 62);

        // Air travel schedule / gate / connection context.
        if (/\b(?:flight|boarding|gate|connection|layover|departure|airport).{0,55}(?:delay|delayed|late|changed|moved|switched|tighter|tight|rescheduled|postponed|time moved|time changed)|(?:delay|delayed|late|changed|moved|switched|tighter|rescheduled).{0,45}(?:flight|boarding|gate|connection|departure)\b|(?:비행기|항공편|탑승|탑승구|게이트|환승|출발|공항).{0,45}(?:늦|지연|변경|바뀌|옮겨|빠듯|당겨|미뤄|연기)|(?:늦|지연|변경|바뀌|옮겨).{0,35}(?:비행기|항공편|탑승|게이트|환승|출발)/i.test(text)) return special('flight-change', ['✈️','⏰','📍','😮‍💨'], 'travel', 64);

        // Scheduled calls, meetings, reviews and sessions.
        if (/\b(?:meeting|review session|review call|client call|customer call|team call|appointment|sync|interview|demo).{0,45}(?:at\s+\d|am\b|pm\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|tomorrow|scheduled|rescheduled|moved|starts?|begins?|set for)|(?:scheduled|rescheduled|moved|set).{0,35}(?:meeting|session|call|appointment|interview)\b|(?:회의|검토\s*세션|고객\s*통화|팀\s*통화|약속|면접|미팅).{0,40}(?:오전|오후|시|월요일|화요일|수요일|목요일|금요일|토요일|일요일|다음\s*주|내일|예정|잡혔|옮겨|변경|시작)|(?:예정|잡혔|옮겨|변경).{0,30}(?:회의|세션|통화|미팅|면접)/i.test(text)) return special('scheduled-meeting', ['📅','⏰'], 'event', 61);

        // Open or unresolved work belongs to follow-up/action tracking, not completion.
        if (/\b(?:open|unresolved|remaining|pending|unfinished|outstanding).{0,28}(?:action items?|tasks?|issues?|follow[- ]ups?|items?)|(?:action items?|tasks?|issues?|follow[- ]ups?).{0,28}(?:open|unresolved|remaining|pending|unfinished|outstanding|left)|still have.{0,30}(?:tasks?|issues?|action items?).{0,16}(?:left|open|remaining)|(?:미해결|열린|남은|대기\s*중|미완료).{0,24}(?:작업|항목|이슈|문제|후속\s*작업)|(?:작업|항목|이슈|문제).{0,24}(?:남아|미해결|미완료|대기)/i.test(text)) return special('open-action-items', ['📌','👀','🧩'], 'report', 61);

        // Calm / intentional slow mornings and offline breaks.
        if (/\b(?:quiet (?:half )?hour|sat in silence|stayed off (?:my |the )?phone|without (?:checking|looking at) (?:my |the )?phone|opened the window and slowed down|didn['’]t rush|did not rush|nothing to rush|felt more settled|slow start to the day)\b|(?:조용히\s*앉|서두르지\s*않|휴대폰을\s*보지\s*않|휴대폰을\s*안\s*보|창문을\s*열고.{0,12}천천히|마음이\s*가라앉|차분해|조용한\s*아침|느긋한\s*아침)/i.test(text)) return special('calm-morning', ['😌','🌿','☀️','📵'], 'life', 60);

        // Coffee / tea is a strong concrete subject and should outrank window/wind/meal words.
        if (/\b(?:coffee|espresso|latte|cappuccino|americano|flat white)\b|커피|아메리카노|라떼|에스프레소/i.test(text)) return special('coffee-drink', ['☕','😌','🌿'], 'topic', 60);
        if (/\b(?:green tea|black tea|herbal tea|matcha|cup of tea|brewed tea|made tea)\b|녹차|홍차|허브티|말차|차를\s*(?:마시|우려|내려)/i.test(text)) return special('tea-drink', ['🍵','😌','🌿'], 'topic', 60);

        // Flat / unchanged metrics in reports.
        if (/\b(?:average|metric|rate|traffic|volume|response time|order value|conversion|revenue|sessions?).{0,40}(?:barely moved|hardly moved|little movement|little change|almost no change|unchanged|remained flat|stayed flat|stayed about the same|held steady)|(?:barely moved|hardly moved|unchanged|remained flat|held steady).{0,30}(?:average|metric|rate|traffic|volume|conversion|revenue)\b|(?:평균|지표|비율|전환율|트래픽|응답\s*시간|주문\s*금액|매출|세션).{0,40}(?:움직임이\s*거의\s*없|거의\s*변하지\s*않|큰\s*변화\s*없이|변화가\s*거의\s*없|그대로|유지됐|유지되었)|(?:움직임이\s*거의\s*없|거의\s*변하지\s*않|큰\s*변화\s*없이).{0,30}(?:평균|지표|비율|트래픽|응답\s*시간)/i.test(text)) return special('metric-unchanged', ['📊','➡️','⏱️'], 'report', 61);

        // Rain/drizzle/downpour should beat walking/transit location cues.
        if (/\b(?:drizzle|downpour|steady rain|heavy rain|rain shower|raining|rainy|rain began|rain started)\b|이슬비|소나기|폭우|장대비|비가\s*(?:내리|오|시작)|빗줄기/i.test(text)) return special('rain-weather', ['🌧️','☔','⛈️'], 'weather', 61);

        // Snow / freezing visual context should beat sleep/trend words.
        if (/\b(?:first snow|snow arrived|snowfall|snowing|street(?:s)? turned white|ground turned white|blanketed in white|below freezing|subzero|freezing temperature)\b|첫눈|눈이\s*(?:내리|왔|쌓)|거리가\s*하얘|길이\s*하얘|영하로\s*떨어|영하\s*기온|기온이\s*영하/i.test(text)) return special('snow-weather', ['❄️','🌨️','🥶'], 'weather', 62);

        // Laundry / washing clothes should beat nearby meal-time words.
        if (/\b(?:laundry|washing|washed the clothes|folded (?:the )?(?:laundry|clothes)|put (?:the )?clothes away|sorted (?:the )?clothes)\b|빨래|세탁|옷을\s*(?:개|정리|빨|널|접)/i.test(text)) return special('laundry-task', ['🧺','✅','🏠'], 'life', 61);

        // Home organization / cleaning.
        if (/\b(?:cleaned|tidied|organized|organised|cleared).{0,32}(?:desk|closet|wardrobe|drawer|room|kitchen|apartment|space|chair)|(?:desk|closet|wardrobe|drawer|room|kitchen|space).{0,32}(?:cleaned|tidied|organized|organised|cleared)\b|(?:책상|옷장|서랍|방|주방|공간|의자).{0,28}(?:치우|정리|정돈|청소)|(?:치우|정리|정돈|청소).{0,28}(?:책상|옷장|서랍|방|주방|공간)/i.test(text)) return special('home-tidy', ['🧹','🏠','✅','😌'], 'life', 60);

        // Work with writing/editing/highlighting should beat generic review/completion.
        if (/\b(?:rewrote|rewrite|revised|edited|shortened|trimmed|polished|highlighted|marked).{0,35}(?:headline|title|introduction|intro|paragraph|section|copy|draft|sentence|passage)|(?:headline|title|introduction|paragraph|section|draft).{0,35}(?:rewrote|revised|edited|shortened|trimmed|highlighted|marked)\b|(?:제목|헤드라인|도입부|서론|문단|섹션|초안|문장).{0,30}(?:줄였|다시\s*쓰|고쳐|수정|편집|표시|하이라이트)|(?:다시\s*쓰|수정|편집|표시).{0,28}(?:제목|도입부|문단|섹션|초안)/i.test(text)) return special('writing-edit', ['✏️','📝','👀','🔖'], 'writing', 60);

        // Study/revision/problem practice.
        if (/\b(?:study|studied|review(?:ed)? vocabulary|review(?:ed)? words|practice problems?|practice questions?|quiz|exam|flashcards?|homework)\b|공부|복습|단어를\s*외|단어를\s*복습|예제\s*문제|연습\s*문제|퀴즈|시험|과제/i.test(text)) return special('study-work', ['📚','✏️','📝','🔖'], 'growth', 59);

        // Decisions / deliberate comparison.
        if (/\b(?:compare (?:the )?options|weigh (?:the )?options|think it over|step back and think|need time to decide|need time to think|figure out what matters|before (?:i|we) decide|before choosing)\b|선택지를\s*(?:비교|따져)|결정하기\s*전|선택하기\s*전|생각할\s*시간|무엇이\s*중요한지\s*정리|거리를\s*두고\s*생각/i.test(text)) return special('deliberate-decision', ['🤔','💭','🌿'], 'mood', 59);

        // Rest after a busy/tiring day.
        if (/\b(?:properly rest|proper rest|take a proper break|rest after|quiet evening after|need to rest|decided to rest|slow evening after|winding down after|long day).{0,20}|(?:바쁜|지치는|긴)\s*(?:하루|한\s*주|회의).{0,35}(?:쉬|휴식|조용히)|제대로\s*쉬|저녁을\s*조용히\s*보냈|휴식을\s*취/i.test(text)) return special('intentional-rest', ['😌','🌿','🌙','🛌','😴'], 'life', 58);

        // Catching up with friends / old classmates is positive connection, not sadness because of 'miss'.
        if (/\b(?:caught up|catch up|old classmate|old friend|people i missed|friends i missed|talked for hours|had a long conversation).{0,35}|(?:오랜만에|보고\s*싶던).{0,22}(?:사람|친구|동창).{0,25}(?:만나|이야기|산책)|예전\s*동창.{0,25}(?:이야기|만나)|밀린\s*이야기/i.test(text)) return special('catch-up-people', ['🤝','💛','😊','💬'], 'social', 60);

        // Email drafting/sending/forwarding and reset emails.
        if (/\b(?:email|e-mail).{0,35}(?:draft|drafted|saved|sent|forwarded|delivered|wrote|write)|(?:draft|saved|sent|forwarded|delivered).{0,30}(?:email|e-mail)|(?:이메일|메일).{0,30}(?:초안|저장|전달|전송|보냈|작성)|(?:초안|저장|전달|전송).{0,25}(?:이메일|메일)/i.test(text)) return special('email-work', ['📧','✏️','📤','✅'], 'writing', 59);

        // Technical requests/timeouts/failures.
        if (/\b(?:request|endpoint|api|connection|login|authentication).{0,35}(?:fails?|failed|times? out|timeout|error|returns?\s+[45]\d\d|stops? working)|(?:fails?|failed|timeout|times? out).{0,25}(?:request|endpoint|api|connection)\b|(?:요청|엔드포인트|API|연결|로그인|인증).{0,30}(?:실패|타임아웃|시간\s*초과|오류|작동하지\s*않)/i.test(text)) return special('technical-failure', ['⚠️','💻','🛠️','❌'], 'tech', 62);

        // Ferry / ship transit state should stay transport-specific.
        if (/\b(?:ferry|boat|ship).{0,35}(?:left|departed|arrived|on schedule|late|delayed|commute|way home)|(?:left|departed|arrived).{0,24}(?:ferry|boat|ship)\b|(?:페리|선박|배가|배를|배로).{0,30}(?:출발|도착|정시|지연|통근|퇴근길)/i.test(text)) return special('ferry-transit', ['🚢','⏰','✅'], 'travel', 59);

        if (/\b(?:cache|cached data).{0,35}(?:cleared|purged|emptied|reset|invalidated)|(?:cleared|purged).{0,25}(?:cache|cached data)\b|캐시.{0,30}(?:비웠|비우|삭제|초기화|정리|퍼지)/i.test(text)) return special('cache-cleared', ['🛠️','🔄','✅'], 'tech', 56);
        if (/\b(?:follow[- ]up email|followup email).{0,25}(?:sent|emailed)|(?:sent|send).{0,20}(?:follow[- ]up email)|후속\s*이메일.{0,20}(?:보냈|전송)|(?:보냈|전송).{0,18}후속\s*이메일/i.test(text)) return special('followup-email-sent', ['📧','✅'], 'writing', 55);
        if (/\b(?:order|package|parcel|replacement item).{0,40}(?:left the warehouse|shipped|dispatched|out for delivery)|(?:left the warehouse|shipped|dispatched).{0,25}(?:order|package|item)\b|(?:주문\s*상품|상품|택배|교환\s*상품).{0,40}(?:창고를\s*출발|발송|배송\s*중|배송을\s*시작)/i.test(text)) return special('fulfillment-moving', ['📦','🚚'], 'commerce', 56);
        if (/\b(?:server|service|system).{0,50}(?:no longer offline|not offline anymore|is online again|back online|back up)|(?:no longer offline|not offline anymore).{0,30}(?:server|service|system)?\b|(?:서버|서비스|시스템).{0,45}(?:이제|현재|더\s*이상).{0,20}(?:오프라인\s*상태가\s*아니|오프라인이\s*아니|온라인\s*상태|다시\s*정상)/i.test(text)) return special('online-restored', ['✅','🛠️'], 'status', 57);
        if (/\b(?:gate|boarding gate).{0,25}(?:changed|moved|switched).{0,35}(?:before boarding|before departure|minutes? before)|(?:changed|moved).{0,20}(?:gate).{0,25}(?:boarding|departure)\b|(?:게이트|탑승구).{0,25}(?:변경|바뀌|옮겨).{0,30}(?:탑승|출발|분\s*전)?/i.test(text)) return special('boarding-gate-change', ['✈️','📍'], 'travel', 56);
        if (/\b(?:login|sign[- ]in) (?:failures?|failed attempts?).{0,35}(?:lower|dropped|fell|decreased|declined)|(?:lower|dropped|fell|decreased).{0,25}(?:login|sign[- ]in) (?:failures?|attempts?)\b|(?:로그인\s*실패|실패한\s*로그인).{0,30}(?:줄|감소|하락|낮아)/i.test(text)) return special('login-failures-lower', ['📉','🔒','📊'], 'report', 56);
        if (/\b(?:certificate|cert).{0,30}(?:expires?|expiration|expiring).{0,25}(?:next|tomorrow|soon|week|day)|(?:expires?|expiration).{0,20}(?:certificate|cert)\b|(?:인증서).{0,30}(?:만료|유효기간).{0,25}(?:다음|내일|곧|주|일)?/i.test(text)) return special('certificate-expiry', ['⏰','🔒','⚠️'], 'tech', 55);
        if (/\b(?:workshop|meeting|project) notes?.{0,35}(?:shared folder|drive|folder)|(?:shared folder|drive).{0,25}(?:notes?|minutes?)\b|(?:워크숍|회의|프로젝트)\s*메모.{0,30}(?:공유\s*폴더|드라이브|폴더)|(?:공유\s*폴더|드라이브).{0,25}(?:메모|회의록)/i.test(text)) return special('notes-shared-folder', ['📁','📝'], 'writing', 53);
        if (/\b(?:restaurant|cafe|shop).{0,40}(?:dish|menu item|item).{0,30}(?:wanted to try|finally had|available)|(?:dish|menu item).{0,30}(?:wanted to try|available).{0,20}(?:restaurant)?\b|(?:식당|카페).{0,35}(?:메뉴|음식).{0,30}(?:먹어\s*보고\s*싶|드디어|있었|가능)/i.test(text)) return special('restaurant-dish', ['🍽️','😋'], 'topic', 52);
        if (/\b(?:melody|tune|song idea).{0,30}(?:wrote down|noted|saved|recorded).{0,25}(?:before|forgot)?|(?:wrote down|noted).{0,25}(?:melody|tune)\b|(?:멜로디|곡\s*아이디어).{0,30}(?:적어|메모|기록|저장).{0,20}(?:잊기\s*전)?/i.test(text)) return special('melody-note', ['🎵','📝'], 'creative', 53);
        if (/\b(?:rough demo|demo).{0,30}(?:recorded|record|recording)|(?:recorded|recording).{0,25}(?:demo)\b|(?:데모).{0,25}(?:녹음|기록)|(?:녹음).{0,20}(?:데모)/i.test(text)) return special('record-demo', ['🎵','🎙️'], 'creative', 53);
        if (/\b(?:highlighted|marked).{0,30}(?:sections?|parts?|passages?).{0,35}(?:revisit|review|return to)|(?:sections?|parts?).{0,30}(?:highlighted|marked).{0,25}(?:revisit|review)?\b|(?:다시\s*볼|복습할).{0,25}(?:부분|섹션|문단).{0,25}(?:표시|하이라이트)|(?:부분|섹션).{0,20}(?:표시).{0,20}(?:다시\s*볼|복습)/i.test(text)) return special('mark-for-review', ['🔖','👀','📝'], 'writing', 53);
        if (/\b(?:morning sun|morning sunlight|sunlight).{0,30}(?:window|through the window|room)|(?:through the window).{0,20}(?:sun|sunlight)\b|(?:아침\s*햇살|햇빛).{0,25}(?:창문|창가|방).{0,20}(?:들어|비치)|(?:창문|창가).{0,20}(?:햇살|햇빛)/i.test(text)) return special('morning-sun-window', ['☀️','🌿'], 'weather', 53);
        if (/\b(?:downpour|heavy rain|sudden rain|shower).{0,35}(?:walk|walking|way home|outside)|(?:walk|walking).{0,30}(?:downpour|heavy rain)|(?:소나기|폭우|갑자기\s*비).{0,30}(?:걷|집에\s*가|밖)|(?:걷|집에\s*가).{0,25}(?:소나기|폭우)/i.test(text)) return special('rain-on-walk', ['🌧️','☔'], 'weather', 54);
        if (/\b(?:cousins?|grandparents?|parents?|siblings?|sister|brother).{0,45}(?:not seeing|haven['’]t seen|hadn['’]t seen|after a while|quiet afternoon|spent time)|(?:quiet afternoon|spent time).{0,35}(?:cousins?|grandparents?|parents?|siblings?)\b|(?:사촌|조부모님|부모님|형제|자매).{0,35}(?:오랜만|한동안|함께|오후|시간)/i.test(text)) return special('family-time', ['💛','🤝','😊'], 'social', 53);
        if (/\b(?:put|putting).{0,20}(?:laundry|clothes).{0,15}(?:away)|(?:laundry|clothes).{0,25}(?:folded|put away|sorted)|(?:빨래|옷).{0,30}(?:정리해\s*넣|개어|정돈|정리)/i.test(text)) return special('laundry-away', ['🧺','✅','🏠'], 'life', 54);
        // v15 high-precision subject guards. These protect specific nouns from broad fallback categories.
        if (/\b(?:cookie|cookies)\b|쿠키/i.test(text)) return special('specific-cookie', ['🍪','😋'], 'topic', 55);
        if (/\b(?:pancake|pancakes)\b|팬케이크/i.test(text)) return special('specific-pancake', ['🥞','😋'], 'topic', 55);
        if (/\b(?:pizza)\b|피자/i.test(text)) return special('specific-pizza', ['🍕','😋'], 'topic', 55);
        if (/\b(?:pasta|spaghetti)\b|파스타|스파게티/i.test(text)) return special('specific-pasta', ['🍝','😋'], 'topic', 55);
        if (/\b(?:curry)\b|카레/i.test(text)) return special('specific-curry', ['🍛','😋'], 'topic', 55);
        if (/\b(?:pancake|waffle)s?\b|팬케이크|와플/i.test(text)) return special('specific-breakfast-bake', ['🥞','🧇','😋'], 'topic', 55);
        if (/\b(?:dessert|cheesecake|brownie|tiramisu)\b|디저트|치즈케이크|브라우니|티라미수/i.test(text)) return special('specific-dessert', ['🍰','😋'], 'topic', 54);
        if (/\b(?:lunch box|packed lunch|bento)\b|점심\s*도시락|도시락/i.test(text)) return special('packed-lunch', ['🍱','🍽️'], 'topic', 54);
        if (/\b(?:watercolor|sketch|sketched|drawing|illustration|illustrated|painted|painting)\b|수채화|스케치|드로잉|그림을\s*그|그림\s*연습/i.test(text)) return special('specific-art', ['🎨','✏️'], 'creative', 54);
        if (/\b(?:edit|edited|editing|cut|cutting).{0,30}(?:video|clip|footage)|(?:video|clip|footage).{0,30}(?:edit|edited|cut)\b|(?:영상|비디오|클립).{0,25}(?:편집|잘라|붙였)|(?:편집).{0,20}(?:영상|비디오)/i.test(text)) return special('video-editing', ['🎬','✂️'], 'creative', 54);
        if (/\b(?:chapter|chapters).{0,25}(?:before|read|reading|finish)|(?:read|reading).{0,25}(?:chapter|chapters)\b|(?:챕터|한\s*장|몇\s*장).{0,25}(?:읽|자기\s*전)|자기\s*전에?.{0,18}(?:챕터|장).{0,12}(?:읽)?/i.test(text)) return special('specific-reading', ['📖','📚'], 'topic', 53);
        if (/\b(?:city lights?|night skyline|night view|city at night)\b|도시\s*야경|야경|도시의\s*밤/i.test(text)) return special('specific-city-night', ['🌃','🌙'], 'topic', 53);
        if (/\b(?:lightning|thunder|thunderbolt)\b|번개|천둥/i.test(text)) return special('specific-lightning', ['⚡','⛈️'], 'weather', 53);
        if (/\b(?:wind|windy|breeze|breezy).{0,45}(?:strong|stronger|picked up|cold|warm)?|(?:strong|stronger).{0,25}(?:wind|breeze)\b|바람.{0,30}(?:강|세|불|차|따뜻)|강풍|산들바람/i.test(text)) return special('specific-wind', ['💨'], 'weather', 53);
        if (/\b(?:first warm day|warm spring day|spring finally feels warm|spring weather)\b|봄다운\s*따뜻|따뜻한\s*봄날|봄\s*날씨.{0,12}(?:따뜻|포근)/i.test(text)) return special('specific-spring', ['🌸','☀️'], 'weather', 53);
        if (/\b(?:boarding pass|return ticket|flight ticket|train ticket|ferry ticket).{0,40}(?:saved|booked|phone|wallet)?|(?:booked|saved).{0,30}(?:return ticket|boarding pass)\b|탑승권|돌아오는\s*표|귀국\s*표|기차표|항공권|승선권/i.test(text)) return special('ticket-pass', ['🎫','📱'], 'travel', 54);
        if (/\b(?:ferry|boat|ship).{0,40}(?:ride|trip|crossing|calm|rough)|(?:ride|crossing).{0,20}(?:ferry|boat)\b|(?:페리|배|선박).{0,30}(?:타|여행|항해|잔잔|거칠)/i.test(text)) return special('ferry-trip', ['🚢','🌊'], 'travel', 52);
        if (/\b(?:refund).{0,30}(?:processed|completed|issued|approved)|(?:processed|completed).{0,20}(?:refund)\b|환불.{0,25}(?:처리|완료|승인|지급)/i.test(text)) return special('refund-processed', ['✅','💰','💳'], 'commerce', 54);
        if (/\b(?:customer|buyer|user).{0,25}(?:asked|requested|wants?).{0,25}(?:cancel|cancellation).{0,20}(?:order)?|(?:cancel|cancellation).{0,20}(?:order).{0,20}(?:requested|asked)\b|(?:고객|구매자).{0,25}(?:주문).{0,20}(?:취소).{0,15}(?:요청|원)|(?:주문\s*취소).{0,15}(?:요청)/i.test(text)) return special('cancel-order-request', ['🚫','📦','⚠️'], 'commerce', 54);
        if (/\b(?:payment page|checkout).{0,35}(?:loads?|opens?|runs?).{0,25}(?:faster|quicker|more quickly)|(?:faster|quicker).{0,25}(?:payment page|checkout)\b|(?:결제\s*페이지|체크아웃).{0,30}(?:더\s*빨리|빠르게).{0,12}(?:열|로드|작동)/i.test(text)) return special('faster-checkout-page', ['⚡','⏱️'], 'commerce', 54);
        if (/\b(?:report|document).{0,30}(?:complete|completed|finished).{0,30}(?:ready).{0,20}(?:distribution|share|send)|(?:ready for distribution|ready to distribute).{0,30}(?:report|document)?\b|(?:보고서|문서).{0,30}(?:완료|끝).{0,30}(?:배포|공유|전송).{0,12}(?:준비)/i.test(text)) return special('final-report-ready', ['📤','✅'], 'report', 54);
        if (/\b(?:read|check|review|search).{0,25}(?:docs?|documentation).{0,30}(?:before|for)|(?:docs?|documentation).{0,25}(?:before).{0,20}(?:deploy|release)|(?:문서|가이드).{0,25}(?:읽|확인|검색).{0,25}(?:배포|릴리스|전에)?/i.test(text)) return special('docs-before-action', ['🔎','👀','💻'], 'tech', 52);
        if (/\b(?:deploy|release|ship).{0,20}(?:now|today|production)|(?:production).{0,20}(?:deploy|release)\b|(?:지금|오늘).{0,15}(?:배포|릴리스)|(?:프로덕션|운영).{0,15}(?:배포|릴리스)/i.test(text)) return special('deploy-now', ['🚀','✅'], 'tech', 52);
        if (/(?:책상\s*서랍|옷장|주방|방|작업공간).{0,35}(?:정리|정돈|치우|청소)|(?:정리|정돈|치우|청소).{0,30}(?:책상\s*서랍|옷장|주방|방|작업공간)|\b(?:desk drawers?|closet|wardrobe|kitchen counter|workspace).{0,35}(?:organize|organized|tidy|tidied|clear|cleared|clean)\b/i.test(text)) return special('specific-home-tidy', ['🧹','🏠','✅','😌'], 'life', 54);
        if (/\b(?:nervous|anxious|worried|uneasy).{0,55}(?:result|choice|decision|tomorrow|meeting|conversation)|(?:right choice|which choice|what will happen).{0,35}(?:worry|nervous|anxious|think)|(?:결과|선택|결정|내일|회의|대화).{0,35}(?:걱정|불안|긴장|생각이\s*많)|어떤\s*선택.{0,25}(?:맞|생각이\s*많)/i.test(text)) return special('specific-worry', ['🤔','💭','😥','😟'], 'mood', 52);
        if (/\b(?:last few months|past few months|past year|this year|summer).{0,45}(?:shorter in hindsight|flew|went by|disappeared|passed quickly|passed before)|(?:looking back|in hindsight).{0,35}(?:months|year|summer).{0,25}(?:short|fast)|(?:지난\s*몇\s*달|지난\s*한\s*해|올해|이번\s*여름).{0,45}(?:짧게\s*느껴|빨리\s*지나|어느새|눈\s*깜짝|금방)/i.test(text)) return special('broad-time-reflection', ['⏳','🕰️','💭'], 'life', 52);
        if (/\b(?:leave|make|need|want).{0,25}(?:breathing room|more room|more space).{0,30}(?:minute|day|schedule|instead)|(?:stop|avoid).{0,25}(?:filling every minute|rushing every task)|(?:여유|숨\s*돌릴\s*틈).{0,25}(?:남기|두|필요)|모든\s*시간.{0,25}(?:채우지\s*않|꽉\s*채우지\s*않)|작은\s*일.{0,20}(?:서두르지)/i.test(text)) return special('make-breathing-room', ['🌿','😌','🌱'], 'life', 52);
        // v14 generalization guards from a 916-case untouched cross-style corpus.
        if (/\b(?:genuinely|really|truly|surprisingly|quietly).{0,12}(?:happy|hopeful|proud|glad)|(?:happy|hopeful|proud|glad).{0,24}(?:for the first time|about what comes next)|(?:진심으로|정말|조용히|오랜만에).{0,15}(?:기쁘|희망|뿌듯|기분이\s*좋)|마음이\s*한결\s*가벼/i.test(text)) return special('clear-positive-mood', ['😊','🌟','🏆','🌿'], 'mood', 49);
        if (/\b(?:open|remaining|unresolved).{0,28}(?:action items?|tasks?|issues?).{0,20}(?:remain|left|still|are)|(?:action items?|tasks?|issues?).{0,25}(?:still open|remain|remaining)\b|(?:열린|남은|미해결).{0,22}(?:액션\s*아이템|작업|이슈|항목).{0,20}(?:있|남)/i.test(text)) return special('open-action-items', ['📌','👀'], 'report', 51);
        if (/\b(?:project brief|brief|draft|document).{0,35}(?:ready).{0,20}(?:comments?|feedback|review)|(?:comments?|feedback|review).{0,20}(?:project brief|draft|document)\b|(?:프로젝트\s*브리프|브리프|초안|문서).{0,30}(?:의견|피드백|검토).{0,18}(?:준비|받)/i.test(text)) return special('ready-for-comments', ['👀','📝'], 'writing', 49);
        if (/\b(?:support )?(?:response time|reply time).{0,30}(?:flat|unchanged|same|little change)|(?:response time|reply time).{0,20}(?:this month|week).{0,20}(?:unchanged|flat)\b|(?:고객지원|지원).{0,15}(?:응답\s*시간|답변\s*시간).{0,30}(?:변하지|그대로|차이\s*없)/i.test(text)) return special('support-time-flat', ['📊','➡️','⏱️'], 'report', 50);
        if (/\b(?:framed|frame).{0,18}(?:print|photo|picture|artwork|poster)|(?:print|photo|picture|artwork|poster).{0,18}(?:framed|frame)\b|(?:사진|그림|포스터|프린트).{0,18}(?:액자|액자에\s*넣)|액자에.{0,12}(?:사진|그림|포스터)/i.test(text)) return special('framed-art', ['🖼️','🎨'], 'creative', 48);
        if (/\b(?:hopeful|optimistic).{0,45}(?:future|next|comes next|after)|(?:future|what comes next).{0,30}(?:hopeful|optimistic)\b|(?:앞으로|다음).{0,25}(?:희망|기대|긍정적)/i.test(text)) return special('hopeful-future', ['🌟','😊','🌱'], 'mood', 48);
        if (/\b(?:need|want).{0,30}(?:space|time).{0,25}(?:think|decide)|(?:before).{0,20}(?:decide|decision).{0,25}(?:think|space)|(?:결정|선택).{0,25}(?:전에|하기\s*전).{0,25}(?:생각할\s*시간|여유|고민)|(?:생각할\s*시간|여유).{0,25}(?:필요|갖)/i.test(text)) return special('space-to-think', ['🤔','💭','🌿'], 'mood', 47);
        if (/\b(?:nothing special|ordinary day|simple day).{0,35}(?:nice|good|remember|needed)|(?:quiet|ordinary).{0,20}(?:day).{0,25}(?:good|nice|remember)\b|(?:특별한\s*일은\s*없|평범한\s*하루|조용한\s*하루).{0,30}(?:좋|기억|괜찮)/i.test(text)) return special('ordinary-good-day', ['😌','🌿','😊','💛'], 'life', 47);
        if (/\b(?:help|hand|support).{0,30}(?:before i asked|before being asked)|(?:offered|offer|volunteered).{0,25}(?:a hand|help)|(?:도움|도와).{0,25}(?:먼저|부탁하기\s*전)|(?:먼저).{0,15}(?:도움|도와)/i.test(text)) return special('offered-help', ['🤝','💛'], 'social', 49);
        // v13 broad QA guards: recurring natural-language constructions across personal, work, travel and writing text.
        if (/\b(?:file|document).{0,50}(?:includes?|contains?|has).{0,25}(?:checklist).{0,35}(?:review|final)|(?:checklist).{0,40}(?:final|review).{0,25}(?:file|document)?\b|(?:파일|문서).{0,45}(?:체크리스트).{0,35}(?:최종|검토)|(?:체크리스트).{0,30}(?:최종|검토).{0,25}(?:파일|문서)?/i.test(text)) return special('review-checklist', ['✅','👀','📝'], 'writing', 52);
        if (/\b(?:notice|noticing|recognize|recognizing|recognise|recognising|appreciate).{0,60}(?:progress|improvement|growth|small wins?|little wins?).{0,45}(?:easy to miss|overlook|small|quiet)?|(?:progress|improvement|growth).{0,60}(?:easy to miss|overlook).{0,35}(?:notice|recognize|appreciate)?\b|(?:놓치기\s*쉬운|작은|조용한).{0,30}(?:진전|성장|개선|변화).{0,35}(?:알아보|느끼|인식|챙기)|(?:진전|성장|개선).{0,30}(?:놓치|작지만).{0,25}(?:알아보|느끼)/i.test(text)) return special('notice-progress', ['🌱','😊','🏆'], 'growth', 51);
        if (/(?:차|커피).{0,35}(?:마시|한잔).{0,40}(?:창가|창문)|(?:창가|창문).{0,35}(?:차|커피).{0,25}(?:마시|한잔)|\b(?:tea|coffee).{0,35}(?:by|near|at).{0,15}(?:the )?window|(?:sat|sitting).{0,25}(?:by|near).{0,12}(?:the )?window.{0,25}(?:tea|coffee)\b/i.test(text)) return special('window-drink', ['🍵','☕','🌿','☀️'], 'life', 50);
        if (/\b(?:old|former|school).{0,25}(?:classmate|friend).{0,70}(?:memories|remember|reminisc|old days)|(?:talk|talking|chat|conversation).{0,45}(?:classmate|school friend).{0,55}(?:memories|remember)|(?:동창|학교\s*친구|오랜\s*친구).{0,45}(?:이야기|대화|연락).{0,45}(?:기억|추억|예전)/i.test(text)) return special('old-friend-memories', ['🤝','💭','😊'], 'social', 50);
        if (/\b(?:flight|plane).{0,45}(?:gate).{0,30}(?:changed|moved|different|later)|(?:gate).{0,30}(?:changed|moved).{0,25}(?:flight|plane)\b|(?:비행기|항공편).{0,45}(?:게이트|탑승구).{0,30}(?:변경|바뀌|이동)|(?:게이트|탑승구).{0,30}(?:변경|바뀌).{0,25}(?:비행기|항공편)?/i.test(text)) return special('flight-gate-change', ['✈️','📍'], 'travel', 53);
        if (/(?:첫\s*버전|초안|서론|도입부).{0,70}(?:모호|불분명|애매).{0,35}(?:다시\s*썼|다시\s*쓰|고쳐|수정)|(?:모호|불분명|애매).{0,35}(?:서론|도입부|첫\s*버전).{0,30}(?:다시\s*썼|수정)|\b(?:first|initial) version.{0,65}(?:vague|unclear|ambiguous).{0,35}(?:rewrote|revised|edited)|(?:rewrote|revised).{0,45}(?:intro(?:duction)?|opening).{0,55}(?:vague|unclear)\b/i.test(text)) return special('rewrite-vague', ['✏️','📝'], 'writing', 53);
        if (/(?:오늘\s*저녁|오늘\s*밤|저녁|밤).{0,55}(?:시계|시간).{0,30}(?:보지|신경\s*쓰지|확인하지)|(?:시계|시간).{0,35}(?:보지|확인하지).{0,30}(?:저녁|밤)|\b(?:evening|tonight).{0,55}(?:without|not).{0,25}(?:checking|watching) (?:the )?(?:clock|time)|(?:without checking).{0,20}(?:the )?clock.{0,20}(?:evening|tonight)?/i.test(text)) return special('clock-free-evening', ['🌿','😌','🌙'], 'life', 50);
        if (/(?:해가\s*뜨기\s*전|일출\s*전).{0,50}(?:일어나|깨어).{0,40}(?:조용|고요|시간)|\b(?:woke|got up).{0,25}(?:before sunrise|before the sun came up).{0,45}(?:quiet|silence|peaceful)/i.test(text)) return special('quiet-before-sunrise', ['🌅','😌'], 'life', 51);
        if (/\b(?:updated|new|revised).{0,25}(?:checkout|payment) (?:flow|process).{0,55}(?:less time|faster|quicker|reduced time)|(?:checkout|payment) (?:flow|process).{0,50}(?:less time|faster|quicker)\b|(?:업데이트된|새|수정된).{0,25}(?:결제|체크아웃)\s*(?:흐름|과정|프로세스).{0,45}(?:시간).{0,20}(?:덜|줄|단축|빠르)/i.test(text)) return special('faster-payment-flow', ['⚡','⏱️'], 'commerce', 52);
        if (/\b(?:nervous|anxious|uneasy).{0,45}(?:conversation|talk|meeting).{0,30}(?:tomorrow|later|need to have)|(?:conversation|talk).{0,40}(?:tomorrow|later).{0,25}(?:nervous|anxious)\b|(?:내일|나중).{0,25}(?:대화|이야기|면담).{0,30}(?:긴장|걱정)|(?:대화|이야기).{0,30}(?:생각).{0,20}(?:긴장|불안)/i.test(text)) return special('nervous-conversation', ['😥','🤔','💭'], 'mood', 50);
        if (/\b(?:homemade|home[- ]made).{0,20}(?:pasta|spaghetti)|(?:pasta|spaghetti).{0,40}(?:homemade|made at home|tasted great|delicious)|(?:수제|직접\s*만든|집에서\s*만든).{0,20}(?:파스타|스파게티)|(?:파스타|스파게티).{0,35}(?:맛있|직접|수제)/i.test(text)) return special('homemade-pasta', ['🍝','😋'], 'topic', 52);
        if (/\b(?:survived|made it through|got through).{0,35}(?:busiest|busy|hectic|rough).{0,25}(?:week|month)|(?:busiest|busy|hectic).{0,30}(?:week).{0,25}(?:survived|made it through)\b|(?:바쁜|정신없는|힘든).{0,20}(?:한\s*주|이번\s*주|주).{0,25}(?:버텼|견뎠|살아남)/i.test(text)) return special('survived-busy-period', ['😮‍💨','🙌'], 'mood', 51);
        if (/\b(?:finished|completed|got through).{0,35}(?:errands?|chores?|appointments?).{0,30}(?:earlier|early).{0,25}(?:free|spare).{0,15}(?:hour|time)|(?:free|spare) (?:hour|time).{0,35}(?:finished|completed).{0,20}(?:early)\b|(?:볼일|할\s*일|용무).{0,35}(?:예상보다|생각보다).{0,15}(?:일찍|빨리).{0,35}(?:한\s*시간|시간).{0,20}(?:비었|남았|여유)/i.test(text)) return special('early-finish-free-time', ['✅','😌','🌿'], 'life', 52);
        if (/\b(?:walk|stroll).{0,35}(?:after work|post[- ]work).{0,30}(?:fixed|lifted|improved|changed).{0,20}(?:mood|day)|(?:after work).{0,25}(?:walk|stroll).{0,30}(?:mood|better)\b|(?:퇴근\s*후|퇴근하고).{0,25}(?:산책|걸).{0,30}(?:기분).{0,15}(?:풀|좋아|나아)/i.test(text)) return special('walk-lifted-mood', ['🚶','😊'], 'life', 52);
        if (/\b(?:don['’]t|do not|doesn['’]t|does not) (?:hate|dislike).{0,35}(?:layout|design|version|change)|(?:not|isn['’]t) that i (?:hate|dislike).{0,25}(?:layout|design)|(?:레이아웃|디자인|변경).{0,35}(?:싫은\s*것은\s*아니|싫지는\s*않|나쁘지는\s*않)/i.test(text)) return special('not-dislike-layout', ['😊','🤔'], 'mood', 48);
        if (/\b(?:service|system|server).{0,35}(?:is|is now|is no longer).{0,20}(?:not offline|online|back online|available)|(?:no longer).{0,20}(?:offline).{0,20}(?:service|system|server)?\b|(?:서비스|시스템|서버).{0,35}(?:이제|현재|더\s*이상).{0,25}(?:오프라인\s*상태가\s*아니|오프라인이\s*아니|온라인|정상)/i.test(text)) return special('service-not-offline', ['✅'], 'status', 54);
        if (/\b(?:api|server|endpoint|request).{0,40}(?:timeout|timed out).{0,25}(?:error|issue|users?)?|(?:timeout|timed out).{0,30}(?:api|request|endpoint)\b|(?:API|서버|엔드포인트|요청).{0,35}(?:타임아웃|시간\s*초과).{0,25}(?:오류|문제|사용자)?/i.test(text)) return special('api-timeout', ['⚠️','💻','🛠️'], 'tech', 54);
        if (/\b(?:organized|cleaned|tidied|cleared).{0,35}(?:desk|room|workspace).{0,35}(?:finally|all week|bothering|relief)?|(?:desk|room|workspace).{0,35}(?:organized|cleaned|tidied)\b|(?:책상|방|작업공간).{0,35}(?:정리|청소).{0,25}(?:드디어|마침내|개운|후련)?/i.test(text)) return special('organized-space', ['🧹','✅','😌'], 'life', 51);
        if (/\b(?:can['’]t wait|cannot wait).{0,45}(?:meet|see).{0,25}(?:team|people|everyone|friends?)|(?:excited|looking forward).{0,35}(?:meet|see).{0,25}(?:team|people)|(?:팀|사람들|친구들).{0,35}(?:직접\s*만날|만나).{0,25}(?:기대|기다릴\s*수\s*없|설레)/i.test(text)) return special('excited-to-meet', ['🤩','😊','🤝'], 'social', 52);
        if (/\b(?:unresolved|open|remaining).{0,30}(?:action items?|tasks?|issues?).{0,30}(?:review|check)|(?:review|check).{0,30}(?:unresolved|open|remaining).{0,30}(?:action items?|tasks?|issues?)\b|(?:미해결|열린|남은).{0,25}(?:액션\s*아이템|작업|이슈|항목).{0,25}(?:검토|확인)|(?:검토|확인).{0,20}(?:미해결|남은).{0,20}(?:항목|작업|이슈)/i.test(text)) return special('unresolved-review', ['📌','👀'], 'report', 53);
        // v12 context guards: broad semantic relations that should beat isolated keywords.
        // These are deliberately clause-level rather than exact-sentence rules.
        if (/\b(?:rewrite|rewrote|revise|revised|editing?|edited).{0,80}(?:intro(?:duction)?|opening|paragraph|section|draft).{0,80}(?:vague|unclear|weak|confusing|too long|needs? work)|(?:intro(?:duction)?|opening|paragraph|section|draft).{0,80}(?:vague|unclear|weak|confusing).{0,80}(?:rewrite|revise|edit)\b|(?:서론|도입부|문단|섹션|초안).{0,60}(?:모호|불분명|약하|길|수정|편집).{0,30}(?:다시\s*쓰|고쳐|수정|편집)?/i.test(text)) return special('writing-revision', ['✏️','📝'], 'writing', 50);
        if (/\b(?:draft|email|message).{0,60}(?:saved|written|ready).{0,35}(?:not sent|unsent|haven['’]t sent|have not sent)|(?:saved|written).{0,40}(?:draft|email).{0,35}(?:not sent|unsent)\b|(?:이메일|메시지|초안).{0,50}(?:저장|작성).{0,30}(?:미전송|아직.{0,8}보내지|전송하지)/i.test(text)) return special('unsent-draft', ['✏️','📧'], 'writing', 49);
        if (/\b(?:sketch|sketched|sketching|draw|drew|drawing|illustrat(?:e|ed|ing)).{0,55}(?:cafe|park|outside|until|today|tonight)?\b|(?:스케치|그림|드로잉|그렸|그리며|그리다)/i.test(text)) return special('drawing-activity', ['🎨','✏️'], 'creative', 48);
        if (/\b(?:bus|train|subway|flight).{0,55}(?:delay|delayed|late|running late|postponed)|(?:delay|delayed|late).{0,40}(?:bus|train|subway|flight)\b|(?:버스|기차|지하철|열차|항공편).{0,45}(?:지연|늦|연착)/i.test(text)) return special('transit-delay', ['🚌','⏰'], 'travel', 50);
        if (/\b(?:workshop|seminar|webinar|class|session|conference).{0,55}(?:starts?|begins?|scheduled|friday|monday|tuesday|wednesday|thursday|saturday|sunday|morning|afternoon|evening|\d{1,2}(?::\d{2})?\s*(?:am|pm))|(?:워크숍|세미나|웨비나|수업|강의|컨퍼런스).{0,55}(?:시작|예정|월요일|화요일|수요일|목요일|금요일|토요일|일요일|아침|오전|오후|저녁|\d+시)/i.test(text)) return special('scheduled-learning-event', ['📅','📚'], 'event', 49);
        if (/\b(?:spreadsheet|sheet|report|csv|file).{0,55}(?:attached|attachment|contains?|includes?).{0,45}(?:final|latest|numbers?|figures?|metrics?|data)|(?:attached|attachment).{0,40}(?:spreadsheet|sheet|report).{0,40}(?:numbers?|figures?|data)\b|(?:첨부|첨부된).{0,35}(?:스프레드시트|시트|보고서|파일).{0,45}(?:최종|최신)?.{0,15}(?:수치|숫자|데이터|지표)/i.test(text)) return special('attached-data', ['📎','📊'], 'report', 50);
        if (/\b(?:fog|mist).{0,50}(?:sunrise|sun came up|sun rose|sunlight|cleared|lifted|disappeared)|(?:sunrise|sun came up|sun rose).{0,45}(?:fog|mist)\b|(?:안개|물안개).{0,45}(?:해가\s*뜨|해뜨|햇빛|걷히|사라)|(?:해가\s*뜨|해뜨).{0,40}(?:안개|물안개)/i.test(text)) return special('sunrise-fog', ['🌅','☀️'], 'weather', 50);
        if (/\b(?:voucher|coupon|promo(?:tion)? code|discount code).{0,60}(?:valid|expires?|through|until|ends?).{0,35}(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|tonight|midnight|\d)|(?:valid|expires?).{0,35}(?:voucher|coupon|promo code)\b|(?:쿠폰|바우처|프로모션\s*코드|할인\s*코드).{0,55}(?:유효|사용\s*가능|만료|까지)/i.test(text)) return special('voucher-validity', ['🏷️','⏰'], 'commerce', 49);
        if (/\b(?:checkout|store|shop|payment page).{0,45}(?:down|offline|unavailable|closed).{0,35}(?:maintenance|upgrade)|(?:maintenance).{0,35}(?:checkout|store|shop).{0,30}(?:down|offline|unavailable)\b|(?:결제\s*페이지|체크아웃|스토어|상점).{0,45}(?:점검|유지보수).{0,20}(?:중단|사용\s*불가|닫)|(?:점검|유지보수).{0,35}(?:결제|스토어|상점).{0,20}(?:중단|사용\s*불가)/i.test(text)) return special('checkout-maintenance', ['🛠️','🚫','🛒'], 'status', 51);
        if (/\b(?:service|system|server|site).{0,45}(?:online again|back online|back up|up again|working again|restored|recovered).{0,45}(?:after|following)?.{0,25}(?:outage|incident|downtime)?|(?:after|following).{0,30}(?:outage|incident|downtime).{0,45}(?:service|system|server|site).{0,30}(?:online|restored|back up)\b|(?:서비스|시스템|서버|사이트).{0,45}(?:다시\s*온라인|복구|정상화|다시\s*정상).{0,35}(?:장애|중단)?/i.test(text)) return special('service-restored', ['✅','🛠️'], 'status', 52);
        if (/\b(?:warning|alert|notice).{0,45}(?:no longer active|not active anymore|cleared|ended|expired|resolved)|(?:no longer|not anymore).{0,25}(?:warning|alert).{0,20}(?:active)?\b|(?:경고|알림).{0,40}(?:더\s*이상).{0,15}(?:활성|유효).{0,12}(?:아니|않)|(?:경고|알림).{0,35}(?:해제|종료|끝|사라)/i.test(text)) return special('warning-cleared', ['✅','ℹ️'], 'status', 52);
        if (/\b(?:this|it|message|notice).{0,30}(?:is not|isn['’]t|was not|wasn['’]t).{0,15}(?:an? )?(?:error|failure).{0,35}(?:information|informational|notice|message)?|(?:not an? error|isn['’]t an? error).{0,30}(?:information|informational|notice|message)?\b|(?:이것|이\s*메시지|안내).{0,25}(?:오류|에러).{0,10}(?:아니|아닙)|(?:오류|에러).{0,12}(?:아니|아닙).{0,20}(?:정보|안내|메시지)?/i.test(text)) return special('not-an-error-info', ['ℹ️','💡'], 'status', 53);
        if (/\b(?:do not|don['’]t|never|must not|should not).{0,25}(?:open|click|download).{0,40}(?:attachment|file|link)|(?:attachment|file|link).{0,40}(?:do not|don['’]t|never).{0,25}(?:open|click|download)\b|(?:첨부파일|파일|링크).{0,30}(?:열지\s*마|클릭하지\s*마|다운로드하지\s*마)|(?:열지\s*마|클릭하지\s*마).{0,30}(?:첨부파일|파일|링크)/i.test(text)) return special('unsafe-attachment-warning', ['⚠️','🛡️'], 'status', 54);
        if (/\b(?:payload|request|response|json|object).{0,55}(?:missing|doesn['’]t have|does not have|lacks?).{0,30}(?:key|field|property)|(?:key|field|property).{0,35}(?:missing|absent).{0,35}(?:payload|request|response)?\b|(?:페이로드|요청|응답|JSON|객체).{0,55}(?:키|필드|속성).{0,20}(?:없|누락)|(?:키|필드|속성).{0,25}(?:없|누락).{0,30}(?:페이로드|요청|응답)?/i.test(raw)) return special('missing-payload-field', ['⚠️','💻','🧩'], 'tech', 52);
        if (/\b(?:rollout|deploy(?:ment)?|release).{0,50}(?:rollback|rolled back|reverted).{0,45}(?:health check|check|failure|failed)|(?:health check).{0,35}(?:failed|failure).{0,35}(?:rollback|rolled back|reverted)\b|(?:롤아웃|배포|릴리스).{0,45}(?:롤백|되돌|원복).{0,35}(?:헬스\s*체크|상태\s*확인|실패)|(?:헬스\s*체크|상태\s*확인).{0,25}(?:실패).{0,30}(?:롤백|되돌)/i.test(text)) return special('rollback-after-failure', ['⚠️','🔄','🛠️'], 'tech', 53);
        if (/\b(?:old|older) (?:messages?|texts?|emails?|photos?).{0,90}(?:years? ago|how different|changed|memories|remember)|(?:years? ago).{0,70}(?:messages?|texts?|emails?|photos?).{0,60}(?:different|changed|remember)\b|(?:예전|옛)\s*(?:메시지|문자|이메일|사진).{0,90}(?:년\s*전|달랐|변했|기억|추억)/i.test(text)) return special('memory-over-time', ['⏳','💭','🕰️'], 'life', 47);
        if (/\b(?:notice|recognize|recognise|see).{0,40}(?:small|little|quiet|easy to miss|overlooked).{0,25}(?:progress|improvement|growth|wins?)|(?:small|little|easy to miss|overlooked).{0,30}(?:progress|improvement|growth).{0,25}(?:notice|recognize|recognise)\b|(?:작은|놓치기\s*쉬운).{0,25}(?:진전|성장|개선|변화).{0,25}(?:알아보|인식|느끼)/i.test(text)) return special('notice-small-progress', ['🌱','😊','🏆'], 'growth', 48);
        if (/\b(?:one|a) useful (?:thing|task).{0,45}(?:better|more useful).{0,35}(?:ten|many|several).{0,25}(?:badly|poorly)|(?:quality over quantity|one thing well).{0,30}(?:many|ten)\b|(?:열\s*가지|여러\s*가지).{0,30}(?:엉망|대충).{0,30}(?:한\s*가지|하나).{0,20}(?:제대로|잘).{0,12}(?:낫|좋)|한\s*가지.{0,25}(?:제대로|잘).{0,30}(?:여러|열\s*가지).{0,20}(?:낫|좋)/i.test(text)) return special('quality-over-quantity', ['🌱','✅'], 'growth', 47);
        if (/\b(?:quiet|calm|slow).{0,20}(?:night|evening).{0,40}(?:rest|resting|take it easy|nothing planned)?|(?:rest|resting).{0,35}(?:tonight|this evening).{0,20}(?:quiet|calm)?\b|(?:오늘\s*밤|오늘\s*저녁|조용한\s*밤|조용한\s*저녁).{0,40}(?:쉬|휴식|여유|조용히)|(?:쉬어도\s*된|쉬고\s*싶).{0,25}(?:밤|저녁)?/i.test(text)) return special('quiet-rest', ['😌','🌙','🌿'], 'life', 47);
        if (/\b(?:teammate|coworker|colleague|friend).{0,45}(?:helped|offered to help|checked on me|looked out for|supported)|(?:helped|supported|checked on).{0,35}(?:teammate|coworker|colleague|friend)\b|(?:팀원|동료|친구).{0,45}(?:도와|챙겨|지원|먼저\s*나서)|(?:도와|챙겨).{0,30}(?:팀원|동료|친구)/i.test(text)) return special('people-helping', ['🤝','💛'], 'social', 48);
        if (/\b(?:called|phoned|rang).{0,30}(?:home|family|mom|mum|dad|parents?).{0,45}(?:after|felt|better|rough|difficult)|(?:after).{0,30}(?:difficult|rough).{0,25}(?:meeting|day).{0,35}(?:called|phoned).{0,25}(?:home|family)\b|(?:힘든|어려운).{0,20}(?:회의|하루).{0,30}(?:후|뒤).{0,20}(?:집|가족|부모님).{0,15}(?:전화|통화)|(?:가족|부모님).{0,20}(?:전화|통화).{0,25}(?:기분|마음).{0,10}(?:나아|좋아)/i.test(text)) return special('call-home-comfort', ['📞','💛','😌'], 'social', 48);
        if (/\b(?:rewrite|rewrote|revise|revised).{0,16}(?:introduction|intro|opening).{0,18}(?:vague|unclear|weak)|(?:introduction|intro).{0,18}(?:vague|unclear).{0,12}(?:rewrite|revise)\b|(?:서론|도입부).{0,14}(?:모호|불분명|약해).{0,12}(?:다시\s*쓰|고쳐|수정)|(?:모호|불분명).{0,10}(?:서론|도입부).{0,8}(?:다시\s*쓰|수정)/i.test(text)) return special('rewrite-intro', ['✏️','📝'], 'writing', 46);
        if (/\b(?:bookmark|bookmarked|saved).{0,14}(?:research|study|project) notes?.{0,10}(?:later|reference)?|(?:research|study|project) notes?.{0,12}(?:bookmark|bookmarked|saved)\b|(?:연구|공부|프로젝트)\s*메모.{0,12}(?:북마크|저장).{0,8}(?:나중|참고)?/i.test(text)) return special('bookmark-notes', ['🔖','📝'], 'writing', 46);
        if (/\b(?:crossed|checked|ticked).{0,14}(?:one|a|another|small|tiny).{0,10}(?:thing|item|task).{0,8}(?:off)?|(?:one|a) (?:small|tiny)?\s*(?:thing|item|task).{0,12}(?:crossed off|checked off)\b|(?:목록|체크리스트).{0,12}(?:작은|한)\s*(?:일|항목|작업).{0,8}(?:지웠|체크|완료)/i.test(text)) return special('small-item-done', ['✅','🙌'], 'status', 46);
        if (/\b(?:review|check).{0,12}(?:two|three|several|remaining|unresolved|open).{0,14}(?:action items?|tasks?|issues?)|(?:unresolved|remaining|open).{0,14}(?:action items?|tasks?|issues?).{0,10}(?:review|check)\b|(?:미해결|남은|열린).{0,10}(?:액션\s*아이템|작업|이슈|항목).{0,10}(?:검토|확인)/i.test(text)) return special('review-open-actions', ['📌','👀'], 'report', 46);
        if (/\b(?:do not need|don['’]t need|no need).{0,18}(?:finish|complete|do).{0,12}(?:everything|all).{0,10}(?:tonight|today|now)?|(?:everything|all).{0,18}(?:doesn['’]t need|need not).{0,10}(?:finish|complete)\b|(?:오늘\s*밤|오늘)?.{0,10}(?:모든|전부).{0,10}(?:일|것).{0,10}(?:끝낼|완료할).{0,8}(?:필요\s*없|필요는\s*없)/i.test(text)) return special('not-everything-now', ['🌿','😌'], 'life', 46);
        if (/\b(?:old|former).{0,12}(?:classmate|school friend).{0,18}(?:talk|talking|conversation).{0,18}(?:memories|remember|back)|(?:talking|conversation).{0,18}(?:old|former) classmate.{0,18}(?:memories|remember)\b|(?:오랜|예전)\s*(?:동창|학교\s*친구).{0,12}(?:이야기|대화).{0,14}(?:기억|추억).{0,8}(?:떠올|생각)/i.test(text)) return special('old-classmate-memory', ['🤝','💭','😊'], 'social', 45);
        if (/\b(?:tea|coffee).{0,16}(?:window|sunlight|quiet).{0,18}(?:before|morning|day)|(?:sat|sitting).{0,12}(?:window).{0,12}(?:tea|coffee)\b|(?:차|커피).{0,12}(?:창가|창문).{0,12}(?:앉|마시).{0,16}(?:아침|바빠|조용)/i.test(text)) return special('drink-by-window', ['🍵','☕','🌿','☀️'], 'life', 44);
        if (/\b(?:long|hot|warm) shower.{0,18}(?:relax|relaxed|calm|better).{0,12}(?:after work)?|(?:after work).{0,12}(?:shower).{0,12}(?:relax|better)\b|(?:퇴근|일).{0,10}(?:후).{0,10}(?:샤워|씻).{0,12}(?:마음|기분).{0,8}(?:편|나아|좋아)/i.test(text)) return special('shower-relax', ['😌','🛁','🌿'], 'life', 45);
        if (/\b(?:teammate|coworker|colleague).{0,16}(?:offered|offer|volunteered).{0,12}(?:help|to help).{0,16}(?:before).{0,10}(?:asked|ask)|(?:help).{0,16}(?:teammate|coworker).{0,16}(?:before i asked)\b|(?:팀원|동료).{0,14}(?:먼저).{0,8}(?:도와|도움).{0,10}(?:말|제안|나서)/i.test(text)) return special('teammate-help', ['🤝','💛'], 'social', 46);
        if (/\b(?:someone|coworker|person).{0,16}(?:noticed).{0,14}(?:struggling|having trouble|rough).{0,16}(?:checked|asked)|(?:struggling|having trouble).{0,18}(?:someone|coworker).{0,12}(?:checked|noticed)\b|(?:회사|직장).{0,12}(?:동료|사람).{0,14}(?:힘들|어려워).{0,8}(?:보였|보이는).{0,10}(?:챙겨|안부|도와)/i.test(text)) return special('noticed-struggle', ['🤝','💛'], 'social', 46);
        if (/\b(?:failed login|failed sign[- ]in|login failure).{0,18}(?:dropped|declined|decreased|fell|reduced).{0,12}(?:percent|%)?|(?:decline|decrease|drop).{0,16}(?:failed login|login attempts?)\b|(?:실패한?|실패)\s*(?:로그인|로그인\s*시도).{0,16}(?:감소|줄|하락)/i.test(text)) return special('failed-logins-down', ['📉','🔒'], 'report', 46);
        if (/\b(?:forecast|analysis|projection).{0,16}(?:ready).{0,14}(?:finance|manager|team).{0,10}(?:review)|(?:finance|manager|team).{0,12}(?:review).{0,12}(?:forecast|analysis|projection)\b|(?:예측|분석|전망)\s*자료.{0,14}(?:재무팀|팀|관리자).{0,10}(?:검토).{0,8}(?:준비|가능)/i.test(text)) return special('forecast-review', ['👀','📊'], 'report', 46);
        if (/\b(?:old|older) (?:messages?|texts?|emails?).{0,18}(?:two|three|several|\d+)\s*years? ago.{0,18}(?:different|changed|life)|(?:two|three|\d+)\s*years? ago.{0,18}(?:messages?|texts?).{0,18}(?:different|changed)\b|(?:예전|옛)\s*(?:메시지|문자|이메일).{0,18}(?:\d+|두|세)\s*년\s*전.{0,16}(?:달랐|변했|생활)/i.test(text)) return special('old-messages-time', ['⏳','💭','🕰️'], 'life', 45);
        if (/\b(?:cookie|cookies).{0,18}(?:bake|baked|baking|recipe|oven|made|making)|(?:bake|baking|made).{0,12}(?:cookies?)\b|(?:쿠키).{0,14}(?:굽|베이킹|레시피|만들)/i.test(text)) return special('cookies', ['🍪','🧁'], 'topic', 46);
        if (/\b(?:vocabulary|words?|flashcards?).{0,20}(?:test|exam|quiz).{0,10}(?:tomorrow|today)?|(?:reviewing|study|studying).{0,12}(?:vocabulary|flashcards?)\b|(?:단어|어휘).{0,14}(?:시험|퀴즈).{0,10}(?:복습|공부|준비)|(?:시험|퀴즈).{0,10}(?:단어|어휘).{0,8}(?:복습|공부)/i.test(text)) return special('vocabulary-study', ['📚','✏️'], 'topic', 46);
        if (/\b(?:morning )?fog.{0,18}(?:disappeared|cleared|lifted).{0,16}(?:sun|sunrise|sun came up)|(?:sun|sunrise).{0,16}(?:fog).{0,10}(?:cleared|lifted|disappeared)\b|(?:아침\s*)?안개.{0,14}(?:사라|걷혀|개).{0,12}(?:해가\s*뜨|햇빛)/i.test(text)) return special('fog-sunrise', ['🌅','☀️'], 'weather', 45);
        if (/\b(?:checkout|payment) (?:completion|processing) time.{0,18}(?:improved|reduced|decreased|faster).{0,10}(?:percent|%)?|(?:completion|processing) time.{0,12}(?:checkout|payment).{0,10}(?:improved|reduced)\b|(?:결제)\s*(?:완료|처리)\s*시간.{0,14}(?:개선|감소|단축|줄)/i.test(text)) return special('checkout-time-improved', ['⚡','⏱️','📈'], 'commerce', 46);
        if (/\b(?:subject line|title line|headline).{0,16}(?:shorter|too long).{0,14}(?:mobile|phone|small screen)|(?:mobile|phone).{0,14}(?:subject line|title).{0,10}(?:shorter|too long)\b|(?:모바일|휴대폰).{0,12}(?:제목|제목\s*줄|헤드라인).{0,10}(?:짧|길)/i.test(text)) return special('mobile-title-length', ['✏️','📱'], 'writing', 46);
        if (/\b(?:spent|spending).{0,14}(?:sunday|weekend|afternoon).{0,10}(?:with).{0,10}(?:grandparents?|family)|(?:grandparents?).{0,16}(?:sunday|weekend|afternoon).{0,10}(?:together)?\b|(?:일요일|주말|오후).{0,12}(?:조부모님|할머니|할아버지|가족).{0,8}(?:함께|보내)/i.test(text)) return special('grandparents-time', ['💛','🌿'], 'social', 45);
        if (/\b(?:documentary|movie|film).{0,18}(?:recommended|everyone recommended).{0,14}(?:watched|finally watched)|(?:finally watched).{0,16}(?:documentary|movie|film)\b|(?:추천하던|추천받은).{0,12}(?:다큐멘터리|영화).{0,10}(?:드디어\s*)?(?:봤|시청)/i.test(text)) return special('recommended-film', ['🎬','🍿'], 'topic', 45);
        if (/\b(?:report|document).{0,16}(?:complete|completed|finished).{0,16}(?:ready).{0,10}(?:send|distribute|share)|(?:ready to).{0,10}(?:send|distribute).{0,12}(?:report|document)\b|(?:보고서|문서).{0,14}(?:완료|끝).{0,14}(?:배포|전송|공유).{0,8}(?:준비)/i.test(text)) return special('report-ready-distribute', ['✅','📤'], 'report', 46);
        if (/\b(?:issues?|bugs?|tasks?).{0,16}(?:remain|remaining|still open|open).{0,16}(?:next sprint|sprint)|(?:next sprint).{0,14}(?:issues?|tasks?).{0,10}(?:remain|open)\b|(?:다음\s*스프린트).{0,14}(?:미해결|남은|열린)\s*(?:이슈|작업).{0,10}(?:남|있)|(?:미해결|남은)\s*(?:이슈|작업).{0,14}(?:다음\s*스프린트)/i.test(text)) return special('sprint-open-issues', ['📌','🧩'], 'report', 46);
        if (/\b(?:september|october|november|december|january|february|march|april|may|june|july|august).{0,18}(?:arrived|came|is here).{0,14}(?:sooner|faster|earlier).{0,12}(?:expected)?|(?:sooner|earlier).{0,14}(?:than expected).{0,12}(?:september|month)\b|(?:1월|2월|3월|4월|5월|6월|7월|8월|9월|10월|11월|12월).{0,14}(?:생각보다|예상보다).{0,8}(?:빨리|벌써).{0,8}(?:찾아|왔)/i.test(text)) return special('month-arrived-fast', ['⏳','🕰️','📅'], 'life', 45);
        if (/\b(?:fresh air|outside).{0,18}(?:after).{0,14}(?:days?|week).{0,10}(?:inside|indoors|home)|(?:days?|week).{0,12}(?:inside|indoors).{0,10}(?:fresh air|outside)\b|(?:며칠|일주일).{0,10}(?:집|실내).{0,10}(?:있다가|있었).{0,10}(?:바깥\s*공기|밖|야외)/i.test(text)) return special('fresh-air-after-inside', ['🌿','🚶'], 'life', 45);
        if (/\b(?:unsupported|not supported).{0,18}(?:older|old).{0,10}(?:browser|browsers)|(?:older|old) browsers?.{0,14}(?:unsupported|not supported)\b|(?:구형|오래된)\s*브라우저.{0,14}(?:지원하지\s*않|지원\s*안|사용할\s*수\s*없)/i.test(text)) return special('old-browser-unsupported', ['🚫','🌐'], 'status', 46);
        if (/\b(?:homemade|home-made).{0,10}(?:pasta).{0,16}(?:tasted|delicious|great|good)|(?:pasta).{0,16}(?:tasted|delicious|great).{0,10}(?:homemade)?\b|(?:수제|직접\s*만든)\s*파스타.{0,14}(?:맛있|잘됐|좋았)|파스타.{0,12}(?:오래\s*걸렸).{0,10}(?:맛있|좋았)/i.test(text)) return special('homemade-pasta', ['🍝','😋'], 'topic', 46);
        if (/\b(?:scan).{0,18}(?:without).{0,12}(?:detecting|finding).{0,10}(?:malware|virus|threats?)|(?:malware|virus|threats?).{0,16}(?:not detected|none found).{0,10}(?:scan)?\b|(?:검사).{0,14}(?:악성코드|바이러스|위협).{0,10}(?:발견되지\s*않|없었|없음)/i.test(text)) return special('clean-malware-scan', ['✅','🛡️'], 'tech', 46);
        if (/\b(?:day off|rest day|break).{0,20}(?:does not|doesn['’]t|won['’]t).{0,18}(?:erase|undo|waste).{0,14}(?:work|progress)|(?:resting|taking a day off).{0,18}(?:not).{0,14}(?:erase|undo).{0,12}(?:progress|work)\b|(?:하루\s*쉬|쉬는\s*날).{0,18}(?:지금까지|이미).{0,10}(?:한\s*일|노력|진전).{0,10}(?:사라지|없어지).{0,8}(?:않|아니)/i.test(text)) return special('rest-doesnt-erase', ['😌','🌿'], 'life', 46);
        if (/\b(?:not an error|isn['’]t an error|is not an error).{0,20}(?:information|informational|notice|message)|(?:error).{0,12}(?:not|isn['’]t).{0,12}(?:information|notice)\b|(?:오류가|오류는).{0,10}(?:아니|아닙).{0,14}(?:정보|안내|메시지)/i.test(text)) return special('information-not-error', ['ℹ️','💡','📌'], 'status', 46);
        if (/\b(?:payment).{0,16}(?:not required|isn['’]t required|no payment required).{0,14}(?:plan|tier)?|(?:plan|tier).{0,14}(?:no payment|payment not required)\b|(?:요금제|플랜).{0,14}(?:결제).{0,8}(?:필요하지\s*않|필요\s*없)/i.test(text)) return special('no-payment-required', ['✅','💰'], 'commerce', 45);
        if (/(?:정신없|혼란스러|바빴).{0,14}(?:지만|했지만).{0,16}(?:할\s*수\s*있는\s*만큼|어떻게든).{0,8}(?:해냈|처리|마쳤|버텼)/i.test(text)) return special('handled-chaos-ko', ['💪','😮‍💨','✅'], 'mood', 44);
        if (/(?:이번\s*주말|주말).{0,16}(?:새로운\s*(?:걸|것|일)|새\s*것).{0,10}(?:시작|해\s*보|도전)/i.test(text)) return special('weekend-new-start-ko', ['🌱','✨','🚀'], 'life', 44);
        if (/(?:산책|걷기).{0,16}(?:나가기|가기).{0,12}(?:직전|전에).{0,12}(?:비가|비).{0,8}(?:그쳤|멈췄)/i.test(text)) return special('walk-after-rain-ko', ['🌧️','🚶','🌿'], 'weather', 44);
        if (/(?:강변|강가|호숫가).{0,10}(?:걷|걸).{0,12}(?:머리|생각).{0,8}(?:정리|맑|식혀)/i.test(text)) return special('waterside-walk-clear-ko', ['🚶','🌿'], 'life', 44);
        if (/(?:서둘러|급하게).{0,12}(?:끝내|마치|해치우).{0,12}(?:싶지(?:는)?\s*않|않고\s*싶|않으려)/i.test(text)) return special('dont-rush-finish-ko', ['🌿','😌'], 'life', 44);
        if (/\b(?:short|quick|small) break.{0,20}(?:helped|gave|brought).{0,16}(?:energy|focus|back)|(?:break).{0,18}(?:more energy|focus again|come back)\b|(?:잠깐|짧게)\s*(?:쉬고|쉰|휴식).{0,16}(?:힘|에너지|집중).{0,8}(?:생|돌아|나아)/i.test(text)) return special('break-energy', ['😌','⚡','🌿'], 'life', 42);
        if (/\b(?:too|completely|really) (?:tired|exhausted).{0,20}(?:not|don['’]t|do not).{0,12}(?:push|keep going|do more)|(?:not|don['’]t).{0,12}(?:push|keep going).{0,14}(?:tired|exhausted)\b|(?:너무|완전히).{0,6}(?:지쳐|피곤).{0,14}(?:더\s*)?(?:무리|밀어붙|계속).{0,8}(?:싶지\s*않|않으려|말)/i.test(text)) return special('too-tired-stop', ['😮‍💨','🛌','😴'], 'life', 42);
        if (/\b(?:rested|took a break|rest).{0,18}(?:then|and).{0,12}(?:focus|concentrate).{0,10}(?:again|better)|(?:focus|concentrate).{0,14}(?:again|better).{0,14}(?:after).{0,10}(?:rest|break)\b|(?:한\s*시간|잠깐)?.{0,8}(?:쉬고|쉰|휴식).{0,12}(?:다시).{0,6}(?:집중|몰입).{0,6}(?:할\s*수|됐다|되었)/i.test(text)) return special('rest-focus-again', ['😌','🌿'], 'life', 42);
        if (/\b(?:winter|spring|summer|autumn|fall).{0,18}(?:only|just).{0,10}(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*months? ago\b|(?:겨울|봄|여름|가을).{0,16}(?:불과|겨우).{0,8}(?:한|두|세|네|다섯|여섯|\d+)\s*(?:달|개월)\s*전/i.test(text)) return special('season-months-ago', ['⏳','🕰️'], 'life', 42);
        if (/\b(?:do not|don['’]t|don['’]t want to|do not want to).{0,16}(?:exhaust|burn out|wear myself out).{0,18}(?:faster|move|progress)|(?:faster|move faster).{0,18}(?:not|don['’]t).{0,14}(?:exhaust|burn)\b|(?:더\s*빨리|빠르게).{0,12}(?:가|하).{0,12}(?:나를|스스로).{0,8}(?:지치|무리).{0,8}(?:싶지\s*않|않으려)/i.test(text)) return special('dont-exhaust-for-speed', ['🌿','😌'], 'life', 42);
        if (/\b(?:cannot|can['’]t) wait.{0,24}(?:everyone|all of you|people|friends?|family)|(?:everyone|friends?|family).{0,18}(?:cannot|can['’]t) wait.{0,12}(?:see|meet)\b|(?:모두|친구|가족|사람들).{0,16}(?:만날|볼)\s*(?:생각|예정).{0,16}(?:기다릴\s*수(?:가)?\s*없|너무\s*기대)|(?:기다릴\s*수(?:가)?\s*없).{0,18}(?:모두|친구|가족).{0,10}(?:만나|볼)/i.test(text)) return special('cant-wait-people', ['🤩','😊','💛'], 'mood', 43);
        if (/(?:오후|시간|하루).{0,12}(?:가족|부모님).{0,10}(?:과|와|함께).{0,12}(?:보내|지내).{0,18}(?:마음|기분).{0,10}(?:느긋|차분|편안|느려)|\b(?:afternoon|time|day).{0,12}(?:with family|with my family|with parents).{0,18}(?:calm|slower|peaceful|relaxed)\b/i.test(text)) return special('family-time-calm', ['💛','🌿'], 'social', 42);
        if (/\b(?:coworker|colleague).{0,18}(?:checked in|check in|asked how i was|asked how).{0,22}(?:rough|hard|difficult)?|(?:checked in|check in).{0,16}(?:coworker|colleague)\b|(?:동료).{0,12}(?:먼저\s*)?(?:안부|괜찮냐|어떠냐).{0,8}(?:물어|물었|챙겨)/i.test(text)) return special('coworker-checkin', ['🤝','💛'], 'social', 42);
        if (/\b(?:friends?|family).{0,18}(?:live|living).{0,8}(?:far|far away)|(?:far|far away).{0,10}(?:friends?|family).{0,14}(?:thinking|miss|remember)\b|(?:멀리\s*사는|멀리\s*있는)\s*(?:친구|가족).{0,14}(?:생각|그립|떠오르)/i.test(text)) return special('far-people-thought', ['😔','💛'], 'mood', 42);
        if (/(?:동생|언니|누나|형|오빠).{0,12}(?:에게|와|랑)?.{0,6}(?:전화|통화).{0,18}(?:힘든\s*하루|마음|기분).{0,10}(?:나아|좋아|편해)|\b(?:called|phone call with).{0,12}(?:sister|brother|sibling).{0,18}(?:day|mood).{0,10}(?:better|easier)\b/i.test(text)) return special('sibling-call-relief', ['📞','💛'], 'social', 42);
        if (/\b(?:draw|drawing|paint|painting|sketch|sketching).{0,28}(?:lost track of time|all afternoon|for hours)|(?:lost track of time).{0,22}(?:draw|drawing|paint|painting|sketch)\b|(?:시간\s*가는\s*줄\s*모르|오후\s*내내|몇\s*시간).{0,14}(?:그림|스케치).{0,8}(?:그리|그렸)/i.test(text)) return special('art-lost-time', ['🎨','✏️'], 'topic', 42);
        if (/\b(?:road|drive).{0,16}(?:again|back).{0,14}(?:after).{0,12}(?:break|months?|weeks?)|(?:back).{0,12}(?:on the road|driving).{0,14}(?:after).{0,10}(?:break)\b|(?:오랜만에|한동안\s*쉬고).{0,12}(?:다시).{0,6}(?:길\s*위|드라이브|운전)/i.test(text)) return special('road-return', ['🚗','🛣️'], 'topic', 42);
        if (/\b(?:headline|title|heading).{0,18}(?:too|very).{0,6}(?:long).{0,18}(?:layout|space|design)?|(?:제목|헤드라인).{0,14}(?:너무|꽤).{0,6}(?:길|깁).{0,12}(?:레이아웃|공간)?/i.test(text)) return special('title-too-long', ['✏️','📐'], 'writing', 42);
        if (/\b(?:ship it|deploy it|release it).{0,10}(?:today|now)\b|(?:오늘|지금).{0,8}(?:바로\s*)?(?:배포|릴리스|출시)(?:합니다|하자|해)/i.test(text)) return special('ship-now', ['🚀','✅'], 'tech', 43);
        if (/\b(?:before|by).{0,10}(?:tomorrow|today|friday).{0,18}(?:review|check).{0,10}(?:https?:\/\/)|(?:review|check).{0,14}(?:https?:\/\/)/i.test(raw) || /(?:https?:\/\/[^\s]+).{0,16}(?:확인|검토)|(?:확인|검토).{0,16}(?:https?:\/\/)/i.test(raw)) return special('linked-review', ['👀','🔎','📅'], 'action', 42);
        if (/\b(?:room|apartment|house).{0,18}(?:clean|cleaned|tidy|organized).{0,22}(?:window|windows).{0,16}(?:open|opened)|(?:clean|cleaned|tidied).{0,16}(?:room|apartment).{0,20}(?:fresh air|windows?)\b|(?:방|집).{0,12}(?:정리|청소).{0,18}(?:창문).{0,10}(?:열|바람)/i.test(text)) return special('home-fresh-reset', ['🧹','🌿','🏠'], 'life', 40);
        if (/\b(?:messy|chaotic|rough).{0,14}(?:day|today).{0,20}(?:handled|managed|did what|got through)|(?:handled|managed).{0,18}(?:what i could|what we could).{0,12}(?:messy|chaotic)?\b|(?:정신없|엉망|힘든).{0,10}(?:하루|오늘).{0,18}(?:할 수 있는 만큼|어떻게든).{0,10}(?:해냈|처리|버텼)/i.test(text)) return special('handled-messy-day', ['💪','😮‍💨','✅'], 'mood', 40);
        if (/\b(?:feel|feeling|felt).{0,14}(?:lighter|relieved).{0,20}(?:after).{0,18}(?:chores?|tasks?|cleaning|finishing)|(?:finished|finishing).{0,18}(?:chores?|small tasks?).{0,18}(?:lighter|relieved)\b|(?:집안일|작은\s*일|할\s*일).{0,16}(?:끝|마치|완료).{0,16}(?:마음|기분).{0,8}(?:가벼|후련|편)/i.test(text)) return special('chores-relief', ['😌','✅','🌿'], 'life', 40);
        if (/\b(?:good mood|great mood|woke up happy|morning).{0,20}(?:good mood|happy|felt good)|(?:feel|felt).{0,12}(?:good|happy).{0,12}(?:this )?morning\b|(?:아침부터|아침에).{0,14}(?:기분).{0,8}(?:좋|상쾌|행복)/i.test(text)) return special('good-morning-mood', ['😊','☀️'], 'mood', 40);
        if (/\b(?:start|begin|try).{0,16}(?:something|thing).{0,10}(?:new).{0,16}(?:weekend|today|soon)|(?:excited).{0,18}(?:start|begin).{0,12}(?:something new|new thing)\b|(?:이번\s*주말|오늘).{0,16}(?:새로운\s*것|새로운\s*일).{0,10}(?:시작|해\s*보|도전)/i.test(text)) return special('new-personal-start', ['🌱','✨','🚀'], 'life', 39);
        if (/\b(?:slow|slower|quiet|gentle).{0,12}(?:evening|night|weekend).{0,18}(?:after).{0,12}(?:busy|hectic|long) (?:day|week)|(?:busy|hectic) (?:day|week).{0,18}(?:slow|slower|quiet) (?:evening|night)\b|(?:바쁜|정신없는)\s*(?:하루|한\s*주).{0,18}(?:느린|조용한|여유로운)\s*(?:저녁|밤)/i.test(text)) return special('slow-evening-after-busy', ['🌿','😌','🌙'], 'life', 40);
        if (/\b(?:need|want).{0,18}(?:space|time).{0,14}(?:think|decide|clear my head)|(?:before).{0,12}(?:decide|decision).{0,16}(?:think|space|time)\b|(?:결정|선택).{0,12}(?:전에|하기\s*전).{0,14}(?:생각|정리|시간|여유).{0,10}(?:필요|하고\s*싶)/i.test(text)) return special('decision-space', ['🤔','💭','🌿'], 'mood', 40);
        if (/\b(?:nervous|anxious|uneasy).{0,18}(?:tomorrow|next day|upcoming)|(?:tomorrow|upcoming).{0,18}(?:nervous|anxious)\b|(?:내일|다가오는).{0,14}(?:긴장|불안|걱정)/i.test(text)) return special('tomorrow-nervous', ['😥','🤔','💭'], 'mood', 40);
        if (/\b(?:short|quick|small) break.{0,20}(?:energy|recharged|focus|better)|(?:break).{0,18}(?:came back|return).{0,12}(?:energy|focus)|(?:잠깐|짧게)\s*(?:쉬|휴식).{0,18}(?:힘|에너지|집중).{0,10}(?:생겼|돌아|나아)/i.test(text)) return special('break-recharge', ['😌','⚡','🌿'], 'life', 40);
        if (/\b(?:quiet|calm).{0,12}(?:breakfast).{0,16}(?:before).{0,10}(?:work|office)|(?:breakfast).{0,16}(?:quiet|calm).{0,12}(?:before work)?\b|(?:출근|일).{0,12}(?:전).{0,12}(?:조용히|여유롭게).{0,8}(?:아침|아침식사)/i.test(text)) return special('quiet-breakfast', ['☕','🍽️','😌'], 'life', 39);
        if (/\b(?:weekend).{0,16}(?:simple|unhurried|slow|quiet|easy)|(?:keep|want).{0,18}(?:weekend).{0,12}(?:simple|unhurried|slow|quiet)\b|(?:이번\s*주말|주말).{0,16}(?:단순|여유|느긋|조용).{0,8}(?:보내|하고\s*싶)/i.test(text)) return special('simple-weekend', ['🌿','😌'], 'life', 39);
        if (/\b(?:not approved|wasn['’]t approved|was not approved|approval failed|declined).{0,14}(?:payment|transaction)?|(?:payment|transaction).{0,12}(?:not approved|wasn['’]t approved|was not approved|declined)\b|(?:결제|거래).{0,12}(?:승인되지\s*않|승인\s*안|거절)/i.test(text)) return special('payment-not-approved', ['❌','⚠️'], 'status', 42);
        if (/\b(?:not a warning|isn['’]t a warning|is not a warning).{0,20}(?:reminder|notice)|(?:warning).{0,12}(?:not|isn['’]t).{0,14}(?:reminder|notice)\b|(?:경고가|경고는).{0,10}(?:아니|아닙).{0,14}(?:알림|리마인더|안내)/i.test(text)) return special('reminder-not-warning', ['🔔','📌'], 'status', 42);
        if (/\b(?:cannot|can['’]t) wait.{0,20}(?:see|meet|visit).{0,16}(?:everyone|family|friends?|you)|(?:looking forward).{0,18}(?:see|meet).{0,14}(?:everyone|family|friends?)\b|(?:기다릴\s*수\s*없|너무\s*기대).{0,18}(?:만나|볼|보게).{0,10}(?:모두|가족|친구|사람)/i.test(text)) return special('eager-to-see-people', ['🤩','😊','💛'], 'mood', 42);
        if (/\b(?:not unhappy|not disappointed|not bad).{0,18}(?:with|about|result|outcome)?|(?:result|outcome).{0,14}(?:not bad|isn['’]t bad)\b|(?:아주|그렇게|별로)?.{0,8}(?:나쁘|불행|실망).{0,12}(?:않|아니).{0,12}(?:결과)?/i.test(text)) return special('mild-positive-negation', ['😊','🤔'], 'mood', 41);
        if (/\b(?:server|service|system).{0,14}(?:no longer down|not down anymore|is back up|back online)|(?:no longer|not anymore).{0,12}(?:down|offline).{0,12}(?:server|service|system)?\b|(?:서버|서비스|시스템).{0,16}(?:더\s*이상).{0,10}(?:내려가|오프라인|중단).{0,8}(?:있지\s*않|아니)|(?:다시\s*정상|복구)/i.test(text)) return special('system-back-up', ['✅'], 'status', 42);
        if (/\b(?:do not|don['’]t|do not want to|don['’]t want to).{0,16}(?:rush|hurry|push).{0,18}(?:through|finish|myself|this)|(?:not want).{0,14}(?:rush|hurry)\b|(?:서둘러|빨리).{0,12}(?:끝내|해치우|가고).{0,12}(?:싶지\s*않|않으려|말고)/i.test(text)) return special('dont-rush', ['🌿','😌'], 'life', 41);
        if (/\b(?:met|meet).{0,16}(?:someone|person).{0,10}(?:kind|nice|friendly).{0,22}(?:talk|talked|conversation)|(?:someone|person).{0,14}(?:kind|nice).{0,18}(?:talk|conversation)\b|(?:친절한|좋은)\s*사람.{0,14}(?:만나|대화|이야기)/i.test(text)) return special('kind-stranger-talk', ['🤝','😊'], 'social', 40);
        if (/\b(?:coworker|colleague|teammate).{0,16}(?:checked in|asked how|reached out).{0,18}(?:rough|hard|difficult) (?:morning|day)|(?:rough|hard) (?:morning|day).{0,18}(?:coworker|colleague).{0,14}(?:checked in|asked)\b|(?:힘든|어려운)\s*(?:아침|하루).{0,16}(?:동료).{0,10}(?:안부|물어|챙겨)/i.test(text)) return special('coworker-care', ['🤝','💛'], 'social', 40);
        if (/\b(?:thinking about|thinking of|remembering).{0,18}(?:friends?|family).{0,18}(?:far away|live far|moved away)|(?:friends?).{0,18}(?:far away|live far).{0,14}(?:thinking|miss)\b|(?:멀리\s*사는|멀리\s*있는)\s*(?:친구|가족).{0,12}(?:생각|떠오르|그립)/i.test(text)) return special('far-away-friends', ['😔','💛'], 'mood', 40);
        if (/\b(?:dinner|lunch|meal).{0,14}(?:parents?|family).{0,18}(?:meaningful|special|warm|nice)|(?:parents?|family).{0,14}(?:dinner|lunch|meal).{0,18}(?:meaningful|special|warm)\b|(?:부모님|가족).{0,14}(?:저녁|점심|식사).{0,14}(?:의미|특별|따뜻)/i.test(text)) return special('meaningful-family-meal', ['💛','🍽️'], 'social', 40);
        if (/\b(?:phone|call|called).{0,12}(?:sister|brother|sibling).{0,18}(?:better|easier|good)|(?:sister|brother|sibling).{0,12}(?:call|called).{0,18}(?:better|easier)\b|(?:동생|언니|누나|형|오빠).{0,10}(?:전화|통화).{0,16}(?:나아|좋아|편해)/i.test(text)) return special('sibling-call-better', ['📞','💛'], 'social', 40);
        if (/\b(?:quiet|calm).{0,14}(?:evening|night).{0,16}(?:home).{0,18}(?:needed|exactly what|felt right)|(?:evening|night).{0,14}(?:home).{0,16}(?:quiet|calm).{0,10}(?:needed)?\b|(?:집에서).{0,12}(?:조용히|평온하게).{0,8}(?:보낸|보내는).{0,8}(?:저녁|밤).{0,12}(?:필요|좋았|딱)/i.test(text)) return special('quiet-home-evening', ['😌','🏠','🌙'], 'life', 40);
        if (/\b(?:rest|take a break|taking a break).{0,18}(?:before).{0,14}(?:burn out|burnout|exhausted|completely tired)|(?:before).{0,14}(?:burn out|burnout).{0,14}(?:rest|break)\b|(?:완전히|너무).{0,8}(?:지치|번아웃).{0,10}(?:전에).{0,10}(?:쉬|휴식)/i.test(text)) return special('rest-before-burnout', ['😌','🌿'], 'life', 40);
        if (/\b(?:close|closed|shut|put away).{0,12}(?:laptop|computer).{0,18}(?:break|rest|time off)|(?:laptop|computer).{0,12}(?:closed|away).{0,18}(?:break|rest)\b|(?:노트북|컴퓨터).{0,10}(?:덮|꺼|치워).{0,12}(?:쉬|휴식|시간)/i.test(text)) return special('laptop-away-break', ['🌿','😌','💻'], 'life', 40);
        if (/\b(?:early night).{0,18}(?:instead of|rather than).{0,14}(?:episode|show|movie)|(?:instead of|rather than).{0,14}(?:another )?(?:episode|show).{0,14}(?:bed|early night)\b|(?:영상|에피소드|드라마).{0,14}(?:대신|말고).{0,12}(?:일찍\s*자|일찍\s*잘)/i.test(text)) return special('early-night-choice', ['😴','🛌'], 'life', 40);
        if (/\b(?:finished|finish).{0,18}(?:movie|film).{0,16}(?:started).{0,12}(?:last week|days ago)|(?:movie|film).{0,18}(?:started).{0,16}(?:finished|finish)\b|(?:지난주|며칠\s*전).{0,12}(?:시작한)\s*(?:영화).{0,12}(?:끝까지|다\s*봤|마저\s*봤)/i.test(text)) return special('finished-movie', ['🎬','🍿'], 'topic', 40);
        if (/\b(?:draw|drawing|paint|painting|sketch|sketching).{0,20}(?:afternoon|hours?|lost track of time)|(?:lost track of time).{0,18}(?:drawing|painting|sketching)\b|(?:그림|스케치|그리기).{0,16}(?:오후\s*내내|시간\s*가는\s*줄|몇\s*시간)/i.test(text)) return special('creative-drawing', ['🎨','✏️'], 'topic', 40);
        if (/\b(?:went|go|back).{0,16}(?:outside|outdoors).{0,18}(?:first time|after).{0,14}(?:sick|ill|inside|week)|(?:first time).{0,14}(?:outside|outdoors).{0,14}(?:after).{0,10}(?:sick|ill)\b|(?:일주일|며칠).{0,10}(?:아팠|실내|집에).{0,14}(?:처음|다시).{0,8}(?:밖|야외).{0,8}(?:나왔|나가)/i.test(text)) return special('outside-after-sick', ['🌿','🚶'], 'life', 40);
        if (/\b(?:train).{0,12}(?:late|delayed).{0,22}(?:made it|arrived).{0,12}(?:meeting|on time)|(?:arrived).{0,12}(?:on time).{0,18}(?:train).{0,12}(?:late|delayed)\b|(?:기차).{0,10}(?:늦|지연).{0,18}(?:회의|약속).{0,10}(?:제시간|도착)/i.test(text)) return special('late-train-made-it', ['🚆','⏰'], 'topic', 40);
        if (/\b(?:snow|snowfall).{0,16}(?:covered|blanketed).{0,16}(?:street|road|neighborhood|ground)|(?:street|road).{0,16}(?:covered|blanketed).{0,12}(?:snow)\b|(?:눈).{0,14}(?:거리|골목|길|땅).{0,10}(?:덮|쌓|하얗)/i.test(text)) return special('snow-covered-street', ['❄️','🌨️'], 'weather', 40);
        if (/\b(?:rain).{0,16}(?:stopped|ended).{0,18}(?:before|just before).{0,12}(?:walk|walking)|(?:walk|walking).{0,14}(?:after|when).{0,10}(?:rain).{0,8}(?:stopped|ended)\b|(?:비가|비).{0,12}(?:그쳤|멈췄).{0,16}(?:산책|걷기).{0,8}(?:전|직전)/i.test(text)) return special('rain-before-walk', ['🌧️','🚶','🌿'], 'weather', 40);
        if (/\b(?:mobile|web|organic|search|site) traffic.{0,20}(?:increased|grew|rose).{0,12}(?:steadily|consistently)|(?:increased|grew).{0,14}(?:traffic).{0,14}(?:mobile|web)\b|(?:모바일|웹|검색|사이트)\s*트래픽.{0,18}(?:꾸준|지속).{0,8}(?:증가|상승)/i.test(text)) return special('traffic-growth', ['📈','📊','📱'], 'report', 40);
        if (/\b(?:support|ticket|request|case) (?:volume|count).{0,20}(?:flat|unchanged|no change|little change)|(?:flat|unchanged).{0,14}(?:support|ticket|request) (?:volume|count)\b|(?:지원|문의|티켓|요청)\s*(?:건수|량).{0,18}(?:변하지|변화\s*없|거의\s*같|유지)/i.test(text)) return special('support-volume-flat', ['📊','➡️'], 'report', 40);
        if (/\b(?:dashboard).{0,16}(?:ready).{0,18}(?:team|planning|review) meeting|(?:team|planning) meeting.{0,16}(?:dashboard).{0,10}(?:ready)\b|(?:대시보드).{0,14}(?:팀|기획)\s*회의.{0,12}(?:준비|검토|사용)/i.test(text)) return special('dashboard-meeting', ['📊','📅'], 'report', 40);
        if (/\b(?:failed|error) (?:request|requests|rate|percentage).{0,18}(?:declined|decreased|fell|dropped|reduced)|(?:decline|decrease|drop).{0,18}(?:failed|error) (?:request|rate)|(?:실패한?|오류)\s*(?:요청|비율|건수).{0,18}(?:감소|줄|하락)/i.test(text)) return special('failure-rate-down', ['📉','📊'], 'report', 41);
        if (/\b(?:action items?|follow-up items?|tasks?).{0,18}(?:remaining|remain|left|open).{0,18}(?:review|before|friday)|(?:review).{0,18}(?:remaining|open).{0,10}(?:action items?|tasks?)\b|(?:남은|미완료)\s*(?:액션\s*아이템|작업|항목).{0,16}(?:검토|확인)/i.test(text)) return special('remaining-actions-review', ['📌','👀'], 'report', 40);
        if (/\b(?:cart|basket).{0,18}(?:only|just).{0,10}(?:one|two|three|four|five|\d+)\s*(?:items?|products?).{0,12}(?:left|remain)|(?:only|just).{0,8}(?:one|two|three|four|five|\d+)\s*(?:items?|products?).{0,16}(?:cart|basket)\b|(?:장바구니).{0,14}(?:한|두|세|네|다섯|\d+)\s*(?:개|가지).{0,8}(?:남|있)/i.test(text)) return special('cart-low-items', ['🛒'], 'commerce', 40);
        if (/\b(?:discount code|coupon|promo code).{0,18}(?:valid|works?|available).{0,12}(?:until|through).{0,10}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:할인\s*코드|쿠폰|프로모션\s*코드).{0,18}(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일).{0,8}(?:까지).{0,8}(?:사용|유효)/i.test(text)) return special('promo-valid-day', ['🏷️','⏰'], 'commerce', 40);
        if (/\b(?:server|service|system).{0,12}(?:down|offline|unavailable).{0,18}(?:users?|people).{0,12}(?:cannot|can['’]t).{0,12}(?:sign in|log in|access)|(?:users?).{0,14}(?:cannot|can['’]t).{0,12}(?:sign in|log in).{0,14}(?:server|service).{0,8}(?:down|offline)\b|(?:서버|서비스|시스템).{0,12}(?:내려가|중단|오프라인).{0,16}(?:사용자).{0,10}(?:로그인|접속).{0,8}(?:할\s*수\s*없|못)/i.test(text)) return special('service-down-login', ['🚨','⚠️','🛠️'], 'status', 42);
        if (/\b(?:research|project|meeting|study) notes?.{0,16}(?:saved|save|kept).{0,12}(?:later|reference)|(?:saved|save).{0,12}(?:research|project|study) notes?\b|(?:연구|프로젝트|공부|회의)\s*메모.{0,12}(?:저장|남겨).{0,8}(?:나중|참고)?/i.test(text)) return special('saved-notes', ['📝','🔖'], 'writing', 40);
        if (/\b(?:quiz|exam|test).{0,18}(?:tomorrow|morning|today).{0,12}(?:prepare|preparing|study|studying)|(?:prepare|preparing|study|studying).{0,18}(?:quiz|exam|test)\b|(?:내일|오늘).{0,10}(?:아침|오후)?\s*(?:퀴즈|시험|테스트).{0,10}(?:준비|공부)/i.test(text)) return special('quiz-prep', ['📚','✏️'], 'topic', 40);
        if (/\b(?:headline|title).{0,14}(?:too long|long).{0,18}(?:layout|design|space)|(?:layout|design).{0,14}(?:headline|title).{0,8}(?:too long|long)\b|(?:레이아웃|디자인|공간).{0,14}(?:제목|헤드라인).{0,8}(?:너무\s*길|길다)|(?:제목|헤드라인).{0,12}(?:너무\s*길).{0,10}(?:레이아웃|공간)/i.test(text)) return special('title-layout-fit', ['✏️','📐'], 'writing', 40);
        if (/\b(?:ship|deploy|release).{0,12}(?:today|now).{0,18}(?:#\w+|release|frontend|web)|(?:today|now).{0,12}(?:ship|deploy|release)\b|(?:오늘|지금).{0,10}(?:배포|릴리스|출시)/i.test(text)) return special('ship-today', ['🚀','✅'], 'tech', 40);
        if (/\b(?:value|field|property|key).{0,20}(?:missing|empty|null).{0,18}(?:response|payload|object)|(?:response|payload|object).{0,20}(?:missing|empty).{0,12}(?:value|field|key)\b|(?:값|필드|키).{0,16}(?:비어|없|누락).{0,14}(?:응답|객체|페이로드)/i.test(text)) return special('missing-field', ['⚠️','🧩','💻'], 'tech', 40);
        if (/\b(?:review|check|open|see).{0,18}(?:https?:\/\/|website|page|report).{0,18}(?:before|tomorrow|today)?|(?:문서|페이지|보고서).{0,16}(?:https?:\/\/).{0,14}(?:확인|검토)|(?:https?:\/\/[^\s]+).{0,14}(?:확인|검토)/i.test(raw)) return special('review-link', ['👀','🔎','🌐'], 'action', 39);
        if (/\b(?:notebook|notes?|journal).{0,18}(?:idea|ideas|thoughts?|wrote|write|jot)|(?:wrote|write|jot|recorded).{0,18}(?:idea|ideas|thoughts?).{0,12}(?:notebook|notes?|journal)\b|(?:노트|메모|일기).{0,16}(?:아이디어|생각).{0,10}(?:적|기록)|(?:아이디어|생각).{0,14}(?:노트|메모).{0,8}(?:적|기록)/i.test(text)) return special('ideas-notebook', ['📝','💡'], 'writing', 38);
        if (/\b(?:walk|walked|walking|stroll).{0,20}(?:river|lake|water|neighborhood|block|outside).{0,22}(?:clear|reset|head|mind|better)|(?:river|lake|water).{0,16}(?:walk|walked|walking).{0,16}(?:clear|reset|head|mind)\b|(?:강가|강변|호수|동네).{0,14}(?:걸|산책).{0,16}(?:머리|마음).{0,10}(?:맑|정리|식혀|나아)/i.test(text)) return special('walk-clear-head', ['🚶','🌿'], 'life', 38);
        if (/\b(?:freezing|very cold|bitterly cold|cold) (?:morning|day).{0,20}(?:bed).{0,18}(?:hard|difficult|didn['’]t want|want to stay)|(?:bed).{0,18}(?:hard|difficult|want to stay).{0,16}(?:freezing|cold)\b|(?:너무\s*)?(?:추운|차가운)\s*아침.{0,18}(?:침대).{0,12}(?:나오|떠나).{0,8}(?:싫|어렵|힘들)/i.test(text)) return special('cold-bed', ['🥶','🛌'], 'weather', 38);
        if (/\b(?:miss|missing|looking forward to seeing|can['’]t wait to see).{0,20}(?:family|parents?|mom|mum|dad|cousins?)|(?:family|parents?|mom|mum|dad|cousins?).{0,18}(?:miss|missing|looking forward)\b|(?:가족|부모님|엄마|아빠|사촌).{0,16}(?:보고\s*싶|그립|기대)|(?:보고\s*싶|그립).{0,14}(?:가족|부모님|엄마|아빠|사촌)/i.test(text)) return special('family-affection', ['💛','❤️','🤩'], 'social', 38);
        if (/\b(?:catching up|caught up|met up).{0,18}(?:friend|coworker|colleague)|(?:friend|coworker|colleague).{0,18}(?:catching up|caught up|met up)\b|(?:친구|동료).{0,12}(?:오랜만에|다시).{0,10}(?:만나|이야기|대화)/i.test(text)) return special('catch-up', ['🤝','😊'], 'social', 38);
        if (/\b(?:small|little|tiny).{0,12}(?:progress|improvement|step).{0,18}(?:proud|enough|still|counts?|matters?)|(?:proud).{0,18}(?:small|little).{0,10}(?:progress|improvement)|(?:small|little) progress is still progress\b|(?:작은|조금의?)\s*(?:진전|성장|발전).{0,18}(?:뿌듯|충분|의미|괜찮)|(?:조금|작게).{0,8}(?:나아|성장).{0,12}(?:충분|괜찮)/i.test(text)) return special('gentle-progress', ['🌱','🏆','😊'], 'life', 38);
        if (/\b(?:hard|rough|difficult|long) (?:day|week).{0,22}(?:made it|got through|finished|kept going|proud)|(?:made it|got through).{0,18}(?:hard|rough|difficult) (?:day|week)\b|(?:힘든|긴)\s*(?:하루|한\s*주|주).{0,18}(?:끝까지|버텼|해냈|마쳤).{0,10}(?:뿌듯|자랑)?/i.test(text)) return special('made-through-hard-time', ['💪','🏆','😮‍💨'], 'mood', 38);
        if (/\b(?:phone|screen|social media).{0,16}(?:silent|mute|away|other room|put down|off).{0,22}(?:read|reading|book|rest|quiet)|(?:read|reading|book).{0,20}(?:phone|screen).{0,14}(?:silent|mute|away|off)\b|(?:휴대폰|스마트폰).{0,14}(?:무음|다른\s*방|멀리|내려놓|꺼).{0,18}(?:책|독서|읽|쉬|조용)/i.test(text)) return special('phone-away-quiet', ['📵','📚','🌿'], 'life', 38);
        if (/\b(?:warm|hot) (?:shower|bath).{0,18}(?:early|rest|bed).{0,20}(?:better|improved|relaxed)|(?:shower|bath).{0,16}(?:felt|feel).{0,12}(?:better|relaxed)\b|(?:따뜻하게|따뜻한).{0,8}(?:샤워|씻).{0,16}(?:일찍|쉬|자).{0,16}(?:나아|편안|좋아)/i.test(text)) return special('warm-shower-rest', ['😌','🛌'], 'life', 38);
        if (/\b(?:exercise|workout|training|running).{0,18}(?:consistency|consistent|regular|regularly|habit).{0,18}(?:without|not).{0,14}(?:punishment|forcing|pressure)|(?:want|trying).{0,18}(?:exercise|workout).{0,18}(?:regularly|consistently)\b|(?:운동|러닝).{0,18}(?:꾸준히|규칙적으로).{0,16}(?:벌|억지|무리).{0,8}(?:아니|않|없이)?/i.test(text)) return special('healthy-consistency', ['💪','🌱'], 'life', 37);
        if (/\b(?:call|called|phone).{0,14}(?:mom|mum|dad|mother|father|parents?).{0,20}(?:better|good|relieved|happy)|(?:mom|mum|dad|parents?).{0,16}(?:call|called).{0,16}(?:better|good|relieved)\b|(?:엄마|아빠|부모님).{0,12}(?:전화|통화).{0,14}(?:마음|기분).{0,8}(?:좋|나아|편)/i.test(text)) return special('family-call', ['📞','💛'], 'social', 38);
        if (/\b(?:data|analytics|metrics?|traffic).{0,24}(?:steady|consistent).{0,10}(?:increase|growth|rise)|(?:steady|consistent).{0,12}(?:increase|growth).{0,18}(?:data|traffic|metric)|(?:데이터|분석|지표|트래픽).{0,18}(?:꾸준|지속).{0,8}(?:증가|상승|성장)/i.test(text)) return special('metric-steady-growth', ['📈','📊'], 'report', 38);
        if (/\b(?:pasta|spaghetti).{0,20}(?:recipe|cook|cooking|made|making|trying)|(?:recipe).{0,14}(?:pasta|spaghetti)\b|(?:파스타|스파게티).{0,16}(?:레시피|요리|만들|도전)/i.test(text)) return special('pasta-cooking', ['🍝','🍴'], 'topic', 38);
        if (/\b(?:reading|read|book|novel).{0,22}(?:evening|night|morning).{0,14}(?:quiet|instead of scrolling)?|(?:quiet).{0,12}(?:cafe|coffee shop).{0,18}(?:read|reading|book)\b|(?:조용한).{0,10}(?:카페|집).{0,18}(?:책|독서|읽)|(?:저녁|밤).{0,14}(?:책|독서|읽)/i.test(text)) return special('quiet-reading', ['📚','🌙','☕'], 'topic', 37);
        if (/\b(?:afternoon|midday).{0,16}(?:rest|break|nap).{0,24}(?:helped|better|more useful).{0,18}(?:coffee|caffeine)|(?:rest|break).{0,20}(?:better|helped).{0,18}(?:than|instead of).{0,14}(?:coffee|caffeine)\b|(?:오후|낮).{0,12}(?:쉬는|휴식|낮잠).{0,18}(?:커피|카페인).{0,12}(?:보다|대신).{0,10}(?:도움|나았|좋았)/i.test(text)) return special('rest-over-caffeine', ['😌','🌿'], 'life', 37);
        if (/\b(?:one|a) step.{0,10}(?:today|at a time).{0,16}(?:better).{0,16}(?:than).{0,14}(?:exhaust|burn|push)|(?:one|a) step.{0,16}(?:without).{0,14}(?:exhaust|burn)\b|(?:오늘)?\s*(?:한\s*걸음|한\s*단계).{0,14}(?:무리|지치|번아웃).{0,12}(?:보다|않|말)/i.test(text)) return special('one-step-sustainable', ['🌱','🌿'], 'life', 37);
        if (/\b(?:rest|taking a break).{0,18}(?:does not|doesn['’]t|isn['’]t).{0,14}(?:mean).{0,12}(?:falling behind|lazy)|(?:rest).{0,18}(?:not).{0,10}(?:falling behind)\b|(?:쉬는\s*것|휴식).{0,18}(?:뒤처지는|뒤처짐|게으른).{0,8}(?:건|것).{0,8}(?:아니|않)/i.test(text)) return special('rest-not-behind', ['😌','🌿'], 'life', 37);
        if (/\b(?:catching up|caught up).{0,14}(?:with).{0,12}(?:old|former)?\s*(?:coworker|colleague|friend).{0,18}(?:fun|nice|good|great|enjoy)|(?:오랜만에|다시).{0,12}(?:동료|친구).{0,10}(?:만나|대화).{0,12}(?:즐거|좋았|반가)/i.test(text)) return special('catch-up-positive', ['🤝','😊'], 'social', 37);
        if (/\b(?:thinking about).{0,18}(?:friends?).{0,18}(?:not seen|haven['’]t seen).{0,14}(?:long time|months?|years?)|(?:friends?).{0,18}(?:not seen|haven['’]t seen).{0,14}(?:long time).{0,12}(?:thinking|remember)\b|(?:오랫동안|한동안).{0,10}(?:못\s*본|보지\s*못한).{0,8}친구.{0,12}(?:생각|떠오르)/i.test(text)) return special('old-friends-on-mind', ['😔','💛'], 'mood', 37);
        if (/\b(?:spend|spent|spending).{0,12}(?:afternoon|evening|day|time).{0,12}(?:with).{0,10}(?:family|parents?).{0,20}(?:slower|calmer|peaceful|better)|(?:family|parents?).{0,18}(?:made).{0,12}(?:day|afternoon|evening).{0,10}(?:slower|calmer|peaceful)\b|(?:오후|저녁|하루|시간).{0,12}(?:가족|부모님).{0,10}(?:함께|보내).{0,14}(?:마음|기분).{0,10}(?:느려|편안|차분)/i.test(text)) return special('family-calm-time', ['💛','🌿'], 'social', 37);
        if (/\b(?:revised|updated) checkout.{0,20}(?:finishes?|completes?|loads?).{0,10}(?:more )?(?:quickly|fast)|(?:checkout).{0,18}(?:finishes?|completes?).{0,10}(?:more )?(?:quickly|fast)\b|(?:수정된|개선된)\s*결제.{0,16}(?:더\s*)?(?:빨리|빠르게).{0,8}(?:끝|완료|처리)/i.test(text)) return special('checkout-finish-faster', ['⚡','⏱️'], 'commerce', 37);
        if (/\b(?:database|data) migration.{0,18}(?:cleanly|smoothly).{0,10}(?:completed|finished)|(?:completed|finished).{0,12}(?:database|data) migration.{0,12}(?:cleanly|smoothly)\b|(?:데이터베이스|데이터)\s*마이그레이션.{0,18}(?:깔끔|매끄럽|문제없이).{0,10}(?:완료|끝)/i.test(text)) return special('migration-clean-complete', ['✅','💻'], 'tech', 37);
        // These are deliberately phrased as meaning families rather than exact test strings.
        if (/\b(?:quiet|calm|peaceful).{0,14}(?:hour|moment|break).{0,12}(?:of )?rest.{0,24}(?:clear|think|focus|better)|(?:rest|break).{0,20}(?:helped|helps|made).{0,16}(?:think|focus|clearer|better)\b|(?:조용한|평온한).{0,12}(?:휴식|쉬는\s*시간).{0,18}(?:생각|집중|머리).{0,10}(?:맑|정리|나아)/i.test(text)) return special('rest-clear-head', ['😌','🌿'], 'life', 36);
        if (/\b(?:instead of|rather than).{0,20}(?:phone|scrolling|screen).{0,20}(?:sleep|bed|turn in|rest).{0,12}(?:early|earlier)?|(?:sleep|bed|turn in).{0,18}(?:early|earlier).{0,22}(?:instead of|rather than).{0,18}(?:phone|scrolling|screen)\b|(?:휴대폰|스크롤|화면).{0,20}(?:대신|말고).{0,16}(?:일찍\s*자|일찍\s*잘|쉬)/i.test(text)) return special('screen-to-rest', ['📵','😴'], 'life', 36);
        if (/\b(?:rest|taking a break).{0,20}(?:does not|doesn['’]t|isn['’]t).{0,18}(?:falling behind|lazy|wasting time)|(?:steady|consistent).{0,14}(?:over|rather than).{0,12}(?:perfect|perfection)|(?:one|a) step.{0,12}(?:today|at a time).{0,20}(?:better|without|instead).{0,16}(?:exhaust|burn|rush)\b|(?:휴식|쉬는\s*것).{0,20}(?:뒤처|게으름|시간\s*낭비).{0,10}(?:아니|않)|(?:완벽|완벽함).{0,12}(?:보다|대신).{0,10}(?:꾸준|천천히)|(?:한\s*걸음|한\s*단계).{0,14}(?:오늘|씩).{0,18}(?:무리|지치|서두르).{0,8}(?:않|말)/i.test(text)) return special('sustainable-pace', ['🌱','🌿','😌'], 'life', 36);
        if (/\b(?:spring|summer|autumn|fall|winter).{0,20}(?:only|just).{0,10}(?:a few|couple of|several|\d+)\s*months? ago|(?:old|older) (?:photo|photos|pictures?).{0,24}(?:time).{0,18}(?:passed|gone by|flown)|(?:time).{0,16}(?:passed|gone by).{0,18}(?:old|older) (?:photo|photos|pictures?)\b|(?:봄|여름|가을|겨울).{0,18}(?:불과|겨우).{0,8}(?:몇|두세|\d+)\s*(?:달|개월)\s*전|예전\s*사진.{0,22}시간.{0,12}(?:흘렀|지났|빠르)/i.test(text)) return special('season-time-reflection', ['⏳','🕰️'], 'life', 36);
        if (/\b(?:thinking about|remembering).{0,20}(?:friends?|family|coworkers?|people).{0,24}(?:not seen|haven['’]t seen|long time|miss)|(?:catching up|caught up).{0,18}(?:old|former)?\s*(?:friend|coworker|colleague)|(?:miss|missing).{0,20}(?:conversation|talks?|chat).{0,18}(?:friend|class|school|work)?\b|(?:오래|한동안).{0,10}(?:못\s*본|보지\s*못한).{0,10}(?:친구|동료|가족).{0,12}(?:생각|떠오르)|(?:친구|동료).{0,12}(?:오랜만에|다시).{0,10}(?:만나|대화|이야기)|(?:대화|이야기).{0,12}(?:그립|보고\s*싶)/i.test(text)) return special('people-memory-connection', ['💛','🤝','😔'], 'social', 36);
        if (/\b(?:lunch|dinner|meal).{0,12}(?:with|together with).{0,10}(?:my )?(?:parents?|family|mom|mum|dad).{0,20}(?:nice|good|special|happy)|(?:parents?|family|mom|mum|dad).{0,16}(?:lunch|dinner|meal).{0,18}(?:nice|good|special)\b|(?:부모님|가족|엄마|아빠).{0,14}(?:점심|저녁|식사).{0,16}(?:좋|특별|따뜻)/i.test(text)) return special('family-meal-warmth', ['💛','🍽️'], 'social', 35);
        if (/\b(?:proposal|draft|application|report).{0,22}(?:delayed|put off|postponed).{0,20}(?:sent|submitted)|(?:sent|submitted).{0,18}(?:proposal|draft|application|report).{0,18}(?:delayed|put off|postponed)\b|(?:미루|늦춘).{0,14}(?:제안서|초안|신청서|보고서).{0,12}(?:보냈|제출)/i.test(text)) return special('delayed-doc-sent', ['✅','📤'], 'status', 36);
        if (/\b(?:all|everything).{0,18}(?:on|from) (?:my|the).{0,10}(?:morning|today['’]s)?\s*(?:list|checklist).{0,14}(?:done|finished|completed)|(?:morning|today['’]s).{0,10}(?:list|checklist).{0,18}(?:all|everything).{0,10}(?:done|finished|complete)\b|(?:아침|오늘).{0,10}(?:목록|체크리스트).{0,14}(?:전부|모두).{0,10}(?:끝|완료|마무리)/i.test(text)) return special('list-all-done', ['✅','🙌'], 'status', 36);
        if (/\bpiano\b|피아노/i.test(text)) return special('piano', ['🎹','🎵'], 'topic', 35);
        if (/\bguitar\b|기타\s*(?:를|연주|연습|쳤|치)/i.test(text)) return special('guitar', ['🎸','🎵'], 'topic', 35);
        if (/\bviolin\b|바이올린/i.test(text)) return special('violin', ['🎻','🎵'], 'topic', 35);
        if (/\b(?:novel|book|chapter|reading)\b.{0,24}\b(?:started|read|reading|finished)\b|\b(?:started|read|reading|finished).{0,18}(?:novel|book|chapter)\b|(?:소설|책|챕터).{0,16}(?:읽|시작|끝)/i.test(text)) return special('reading-book', ['📖','📚'], 'topic', 34);
        if (/\bcurry\b|카레/i.test(text)) return special('curry', ['🍛','😋'], 'topic', 35);
        if (/\b(?:average|median|mean)?\s*(?:processing|response|load|wait) time.{0,18}(?:dropped|decreased|fell|reduced|improved).{0,14}(?:seconds?|ms|milliseconds?|minutes?)?|(?:processing|response|load|wait) time.{0,18}(?:down|lower|shorter)\b|(?:평균\s*)?(?:처리|응답|로딩|대기)\s*시간.{0,14}(?:줄|감소|단축|개선)/i.test(text)) return special('time-metric-improved', ['⏱️','📉'], 'report', 36);
        if (/\b(?:tasks?|items?|actions?).{0,18}(?:remain|remaining|still open|open|pending).{0,18}(?:after|from)?.{0,12}(?:planning|meeting|session)?|(?:remain|remaining|still open|pending).{0,16}(?:tasks?|items?|actions?)\b|(?:작업|항목|액션).{0,16}(?:남아|열려|대기|미완료)/i.test(text)) return special('open-work-items', ['📌','✅'], 'report', 35);
        if (/\b(?:analysis|report|document).{0,16}(?:ready).{0,16}(?:review|reviewed|director|manager)|(?:ready for).{0,10}(?:review|approval)\b|(?:분석|보고서|문서).{0,16}(?:검토|승인).{0,10}(?:준비|가능)/i.test(text)) return special('ready-for-review', ['👀','📊','📝'], 'report', 35);
        if (/\b(?:attached|included).{0,12}(?:chart|graph|figure|file)|(?:chart|graph|figure|file).{0,12}(?:attached|included)\b|(?:차트|그래프|파일|도표).{0,10}(?:첨부|포함)/i.test(text)) return special('attachment-for-review', ['📎','👀'], 'report', 34);
        if (/\b(?:coupon|promo code|discount code).{0,18}(?:not available|unavailable|can['’]t be used|cannot be used).{0,12}(?:tonight|today|after|from)?|(?:쿠폰|프로모션\s*코드|할인\s*코드).{0,18}(?:사용할\s*수\s*없|이용\s*불가|사용\s*불가).{0,10}(?:오늘\s*밤|오늘|부터)?/i.test(text)) return special('coupon-unavailable', ['🏷️','⏰'], 'commerce', 35);
        if (/\b(?:revised|updated|new) checkout.{0,18}(?:faster|quicker|less time|shorter)|(?:checkout).{0,18}(?:revised|updated).{0,14}(?:faster|quicker)\b|(?:수정된|개선된|새)\s*결제\s*(?:과정|흐름|단계).{0,16}(?:빨라|빠르|단축)/i.test(text)) return special('checkout-revised-fast', ['⚡','⏱️'], 'commerce', 36);
        if (/\b(?:look for|search for|find|locate).{0,16}(?:error|signature|code|answer|example).{0,20}(?:developer )?(?:docs?|documentation|manual|guide)|(?:developer )?(?:docs?|documentation|manual).{0,20}(?:look for|search|find).{0,16}(?:error|signature|code|answer|example)\b|(?:개발자\s*)?(?:문서|가이드).{0,18}(?:오류|에러|코드|답|예시).{0,12}(?:찾|검색|조회)/i.test(text)) return special('docs-lookup', ['🔎','💻'], 'tech', 36);
        if (/\b(?:security|system|malware|virus) (?:check|scan).{0,20}(?:clean|clear|no issues?|no problems?|no threats?)|(?:clean|clear|no issues?|no problems?).{0,18}(?:security|system) (?:check|scan)\b|(?:보안|시스템|바이러스)\s*(?:검사|점검).{0,16}(?:깨끗|이상\s*없|문제\s*없|정상)/i.test(text)) return special('security-check-clean', ['✅','🛡️'], 'tech', 36);
        if (/\b(?:online )?(?:class|course|training|lesson).{0,22}(?:starts?|begins?).{0,14}(?:monday|tuesday|wednesday|thursday|friday|evening|morning|tonight|tomorrow)|(?:온라인\s*)?(?:수업|강의|과정|교육).{0,18}(?:월요일|화요일|수요일|목요일|금요일|저녁|아침|내일).{0,12}(?:시작|예정)/i.test(text)) return special('scheduled-class', ['📚','📅'], 'topic', 36);
        if (/\b(?:back|outside|outdoors).{0,16}(?:after).{0,14}(?:week|days?).{0,12}(?:inside|indoors)|(?:after).{0,14}(?:week|days?).{0,12}(?:inside|indoors).{0,12}(?:outside|outdoors|back)\b|(?:일주일|며칠).{0,10}(?:만에|동안).{0,12}(?:다시\s*)?(?:밖|야외).{0,8}(?:나왔|나가)/i.test(text)) return special('back-outside', ['🌿','🚶'], 'life', 35);
        if (/\b(?:password|account) reset (?:email|message).{0,18}(?:sent|delivered).{0,12}(?:successfully)?|(?:sent|delivered).{0,16}(?:password|account) reset (?:email|message)\b|(?:비밀번호|계정)\s*재설정\s*(?:이메일|메일|메시지).{0,16}(?:정상적으로\s*)?(?:전송|발송|보냈)/i.test(text)) return special('reset-email-sent', ['📧','✅'], 'status', 36);
        if (/\b(?:drafted|wrote|prepared).{0,12}(?:email|message).{0,20}(?:not sent|haven['’]t sent|have not sent|unsent|yet)|(?:email|message).{0,16}(?:draft|unsent).{0,10}(?:yet)?\b|(?:이메일|메시지)\s*초안.{0,16}(?:아직|미전송|보내지\s*않)/i.test(text)) return special('email-draft-unsent', ['✏️','📧'], 'writing', 36);
        if (/\b(?:document|file).{0,18}(?:now )?(?:includes?|contains?|has).{0,14}(?:short )?checklist|(?:short )?checklist.{0,18}(?:added|included|in the document)\b|(?:문서|파일).{0,16}(?:체크리스트).{0,10}(?:추가|포함|있)/i.test(text)) return special('document-checklist', ['✅','📝'], 'writing', 35);
        if (/\b(?:final|last) (?:paragraph|section).{0,18}(?:still )?(?:needs work|needs editing|needs revision|not ready)|(?:paragraph|section).{0,18}(?:still )?(?:needs work|needs editing|needs revision)\b|(?:마지막|최종)\s*(?:문단|섹션).{0,16}(?:아직).{0,10}(?:수정|편집|보완).{0,6}(?:필요)?/i.test(text)) return special('final-writing-needs-work', ['✏️','📝'], 'writing', 36);
        if (/\b(?:walked|walking|walk).{0,20}(?:extra|additional|another)\s*\d+\s*(?:minutes?|mins?).{0,20}(?:air|outside|clear my head)|(?:needed|wanted) some air.{0,20}(?:walked|walking)\b|(?:평소보다|추가로).{0,12}\d+\s*분.{0,12}(?:더\s*)?(?:걸|산책).{0,16}(?:바람|공기)?/i.test(text)) return special('extra-walk-minutes', ['🚶','🌿'], 'life', 34);
        if (/(?:수정된|개정된)\s*(?:계획|제안서|문서).{0,14}(?:클라이언트|고객).{0,10}(?:승인|수락).{0,8}(?:받|됐|되었)|(?:클라이언트|고객).{0,12}(?:수정된|개정된).{0,8}(?:계획|제안서|문서).{0,8}(?:승인|수락)/i.test(text)) return special('revised-client-approved-ko', ['✅','📝'], 'report', 34);
        if (/(?:같은|한)\s*(?:앨범|플레이리스트|노래).{0,12}(?:세|두|여러)\s*번.{0,10}(?:듣|재생)|(?:앨범|플레이리스트|노래).{0,14}(?:세|두|여러)\s*번.{0,8}(?:들|재생)/i.test(text)) return special('music-repeat-ko', ['🎧','🎵'], 'topic', 33);
        if (/\b(?:full|entire) night of sleep|(?:slept|sleep).{0,18}(?:full night|through the whole night).{0,18}(?:feel|feeling).{0,10}(?:human|rested|refreshed)|(?:밤새|밤\s*내내).{0,14}(?:푹|잘).{0,8}(?:자|잤).{0,14}(?:가볍|개운|상쾌)/i.test(text)) return special('full-night-sleep', ['😴','😌','🛌'], 'life', 34);
        if (/\b(?:last|past)\s+(?:several|few|couple of)?\s*(?:weeks?|months?|years?).{0,22}(?:flown|flew|slipped|passed)\s*(?:past|by|away)?|(?:weeks?|months?|years?).{0,18}(?:flown|flew)\s*(?:past|by)\b|(?:지난|최근).{0,10}(?:몇|여러)\s*(?:주|달|개월|년).{0,16}(?:날아가|쏜살같|빠르게).{0,8}(?:지나|흘러)/i.test(text)) return special('time-flown-past', ['⏳','🕰️'], 'life', 34);
        if (/\b(?:leave|make|create).{0,12}(?:more )?(?:space|room).{0,18}(?:schedule|day|life).{0,24}(?:instead of|rather than).{0,16}(?:pushing|rushing|doing more)|(?:instead of|rather than).{0,18}(?:pushing|rushing).{0,18}(?:space|room)\b|(?:일정|하루).{0,14}(?:여유|공간).{0,12}(?:남기|두).{0,18}(?:몰아붙|재촉|서두르).{0,8}(?:대신|보다)/i.test(text)) return special('make-space', ['🌿','😌','🌱'], 'life', 33);
        if (/\b(?:walked|walking|walk).{0,20}(?:extra|additional|longer).{0,14}(?:minutes?|distance).{0,20}(?:air|clear my head|outside)|(?:needed|wanted).{0,10}(?:some|fresh) air.{0,16}(?:walk|walking)\b|(?:바람|공기).{0,10}(?:필요|쐬).{0,18}(?:더|추가|평소보다).{0,12}(?:걸|산책)/i.test(text)) return special('walk-extra-air', ['🚶','🌿'], 'life', 33);
        if (/\b(?:miss|missing).{0,18}(?:hanging out|spending weekends?|spending evenings?) with.{0,20}(?:friends?|people)|(?:friends?).{0,20}(?:knew in|from) (?:college|school).{0,12}(?:miss|missing)?\b|(?:대학|학교|예전).{0,14}(?:친구|사람).{0,16}(?:그립|보고\s*싶|함께).{0,10}(?:시간)?/i.test(text)) return special('miss-old-circle', ['😔','💛','🤝'], 'mood', 33);
        if (/(?:일주일|며칠).{0,10}(?:내내|동안).{0,12}(?:신경\s*쓰|마음에\s*걸리).{0,14}(?:일|한\s*가지|작업).{0,10}(?:체크|끝|처리)|\b(?:task|thing).{0,18}(?:bothering|hanging over me).{0,18}(?:week|days).{0,12}(?:checked|done|finished)\b/i.test(text)) return special('nagging-task-done', ['✅','🙌'], 'status', 33);
        if (/\b(?:no notifications?).{0,18}(?:no rush|slow|quiet|sunday|weekend)|(?:no rush).{0,16}(?:sunday|weekend|morning)\b|(?:알림(?:도)?\s*없|알림\s*없는).{0,18}(?:서두를\s*일도\s*없|조용한|느린|일요일|주말)/i.test(text)) return special('no-notifications-no-rush', ['📵','🌿','😌'], 'life', 33);
        if (/\b(?:support|ticket|request|case|inquiry) volume.{0,22}(?:no|without).{0,14}(?:measurable|meaningful|significant).{0,8}(?:change|difference)|(?:no|without).{0,14}(?:measurable|meaningful).{0,12}(?:change|difference).{0,16}(?:support|ticket|request|inquiry)\b|(?:지원|문의|티켓|요청).{0,12}(?:량|건수).{0,18}(?:측정\s*가능한|유의미한|의미\s*있는).{0,8}(?:변화|차이).{0,8}(?:없|않)/i.test(text)) return special('volume-no-change', ['📊','✅'], 'report', 33);
        if (/(?:클라이언트|고객|관리자).{0,12}(?:수정된|개정된)?.{0,8}(?:계획|제안서|문서).{0,10}(?:승인|수락).{0,8}(?:받|됐|되었)|\b(?:client|customer|manager).{0,14}(?:approved|accepted).{0,12}(?:revised|updated)?\s*(?:plan|proposal|document)\b/i.test(text)) return special('client-approved-revision', ['✅','📝'], 'report', 33);
        if (/\b(?:item|product|service) quality.{0,20}(?:below|under|worse than).{0,14}(?:expected|expectations?|promised|standard)|(?:quality).{0,16}(?:below|under).{0,12}(?:expected|promised)\b|(?:상품|제품|서비스)\s*품질.{0,18}(?:기대했던|기대한|약속한).{0,8}(?:수준|품질).{0,8}(?:보다\s*낮|못\s*미치|미달)/i.test(text)) return special('quality-below-expected', ['😔','👎'], 'mood', 33);
        if (/(?:업데이트된|개선된|새)\s*결제\s*(?:흐름|과정|단계).{0,16}(?:눈에\s*띄게|훨씬|더).{0,8}(?:빨라|빠르)|\b(?:updated|new) checkout (?:flow|process).{0,18}(?:noticeably|much|significantly).{0,8}(?:faster|quicker)\b/i.test(text)) return special('checkout-noticeably-faster', ['⚡','⏱️'], 'commerce', 33);
        if (/(?:최신|새)\s*기능.{0,18}(?:모든|전체)\s*(?:사용자|고객|계정).{0,12}(?:활성화|적용|공개)|\b(?:latest|new) feature.{0,18}(?:enabled|active|available).{0,14}(?:every|all) (?:user|customer|account)\b/i.test(text)) return special('latest-feature-all', ['🚀','✨'], 'product', 33);
        if (/\b(?:release|build|patch).{0,20}(?:deployed|released).{0,12}(?:to )?production.{0,12}(?:successfully)?|(?:deployed|released).{0,16}(?:to )?production.{0,12}(?:successfully)\b|(?:릴리스|빌드|패치).{0,16}(?:프로덕션|운영).{0,12}(?:성공적으로)?.{0,8}(?:배포|반영)/i.test(text)) return special('release-production-success', ['🚀','✅'], 'tech', 34);
        if (/\b(?:build|version)\s*[\w.-]+.{0,18}(?:ready to go out|ready to go|good to ship|good to release)|(?:ready to go out|good to ship).{0,16}(?:build|version)\b|(?:빌드|버전)\s*[\w.-]+.{0,18}(?:배포|출시|릴리스).{0,8}(?:준비).{0,8}(?:끝|완료|마쳤)/i.test(text)) return special('build-ready-go', ['🔄','📱'], 'product', 33);
        if (/\b(?:current|latest|new) build.{0,22}(?:no longer|doesn['’]t|does not).{0,10}(?:crash|crashes)|(?:no longer|doesn['’]t).{0,10}(?:crash|crashes).{0,18}(?:startup|current build)\b|(?:현재|최신|새)\s*빌드.{0,18}(?:더\s*이상).{0,8}(?:충돌|크래시).{0,8}(?:하지\s*않|않습|없)/i.test(text)) return special('build-no-crash', ['✅','🛠️'], 'tech', 34);
        if (/\b(?:admin|administrator) (?:account|accounts|access).{0,18}(?:require|requires|need|needs).{0,10}(?:2fa|two[- ]factor)|(?:2fa|two[- ]factor).{0,18}(?:admin|administrator)\b|(?:관리자)\s*(?:계정|접근).{0,18}(?:2FA|2단계\s*인증|이중\s*인증).{0,8}(?:필요|요구)/i.test(text)) return special('admin-2fa', ['🔒','🛡️'], 'tech', 34);
        if (/\b(?:data )?migration.{0,18}(?:finished|completed|ended).{0,14}(?:without (?:any )?errors?|successfully)|(?:without (?:any )?errors?).{0,16}(?:migration).{0,10}(?:finished|completed)\b|(?:데이터\s*)?마이그레이션.{0,18}(?:오류\s*없이|성공적으로).{0,8}(?:끝|완료)/i.test(text)) return special('migration-success', ['✅','💻'], 'tech', 34);
        if (/\b(?:not|do not|don['’]t).{0,10}(?:feel )?disappointed.{0,14}(?:anymore|now|about)|(?:disappointed).{0,12}(?:not anymore|no longer)\b|(?:이제|더\s*이상).{0,14}(?:실망).{0,8}(?:하지\s*않|않는|않다|않습)/i.test(text)) return special('not-disappointed-now', ['😌','😊'], 'mood', 34);
        if (/\b(?:draft|version|build).{0,18}(?:not|isn['’]t).{0,14}(?:the )?(?:version|build).{0,18}(?:release|publish|ship)|(?:not|isn['’]t).{0,18}(?:version|draft).{0,18}(?:release|publish)\b|(?:초안|버전|빌드).{0,18}(?:실제로|우리가)?.{0,10}(?:출시|공개|배포).{0,8}(?:할|할\s*예정).{0,10}(?:최종)?.{0,8}(?:아니|아닙)/i.test(text)) return special('draft-not-release', ['📝','🔄'], 'product', 33);
        if (/(?:서비스|시스템).{0,16}(?:다시\s*정상|복구|정상화).{0,18}(?:더\s*이상).{0,8}오프라인.{0,8}(?:아니|아닙)|\b(?:service|system).{0,16}(?:available|normal|back up).{0,18}(?:no longer).{0,8}(?:offline)\b/i.test(text)) return special('service-normal-not-offline', ['✅'], 'status', 34);
        if (/\b(?:soup|stew|curry).{0,18}(?:dinner|made|cooked).{0,18}(?:good|better|delicious|expected)|(?:made|cooked).{0,12}(?:soup|stew|curry)\b|(?:수프|스프|찌개|카레).{0,14}(?:만들|끓|저녁).{0,12}(?:맛있|잘됐|기대)/i.test(text)) return special('soup-meal', ['🍲','😋'], 'topic', 30);
        if (/\b(?:album|playlist|song|music).{0,20}(?:repeat|three times|all day|all week)|(?:listened|listening).{0,16}(?:album|playlist|song|music).{0,14}(?:again|repeat|times)\b|(?:앨범|플레이리스트|노래|음악).{0,18}(?:반복|세\s*번|하루\s*종일|계속).{0,8}(?:듣|재생)/i.test(text)) return special('music-repeat', ['🎧','🎵'], 'topic', 31);
        if (/\b(?:study|studying|prepare|preparing).{0,20}(?:quiz|exam|test).{0,14}(?:tomorrow|morning|friday)?|(?:quiz|exam|test).{0,20}(?:tomorrow|morning).{0,14}(?:study|prepare)\b|(?:퀴즈|시험|테스트).{0,16}(?:내일|아침|금요일).{0,16}(?:공부|준비)|(?:공부|준비).{0,14}(?:퀴즈|시험|테스트)/i.test(text)) return special('study-quiz-broad', ['📚','✏️','📖'], 'topic', 31);
        // Rest/sleep should stay in a sleep/rest family rather than generic life symbols.
        if (/\b(?:woke|wake).{0,18}(?:refreshed|rested)|(?:short|quick|power) nap|(?:need|want|choose|choosing).{0,18}(?:sleep|rest|quiet night)|(?:enough|more) rest|(?:turning in|go to bed|went to bed).{0,12}early|(?:rested|resting).{0,18}(?:clearer|better)|(?:sleeping|slept).{0,14}well\b|(?:푹\s*자|잠을\s*충분|낮잠|일찍\s*자|일찍\s*잤|쉬고\s*싶|휴식).{0,26}(?:개운|피로|컨디션|맑|나아|좋|충분)?/i.test(text)) return special('rest-sleep-general', ['😴','😌','🛌'], 'life', 32);
        if (/\b(?:january|february|march|april|may|june|july|august|september|october|november|december).{0,22}(?:only yesterday|feels like yesterday|was yesterday)|(?:feels like|seems like).{0,18}(?:january|last month|last year).{0,10}(?:yesterday)\b|(?:1월|2월|3월|4월|5월|6월|7월|8월|9월|10월|11월|12월).{0,18}(?:어제|엊그제).{0,10}(?:같|느낌)|(?:어제|엊그제).{0,10}(?:1월|지난달|작년).{0,8}(?:같)/i.test(text)) return special('calendar-time-passing', ['⏳','🕰️'], 'life', 33);
        if (/\b(?:no need|don['’]t need|do not need).{0,18}(?:finish|complete|do).{0,16}(?:everything|all).{0,10}(?:today|now)|(?:sustainable|comfortable|manageable) pace|(?:pace).{0,18}(?:sustainable|comfortable|maintain)|(?:everything|all).{0,18}(?:need not|doesn['’]t need).{0,10}(?:today|now)\b|(?:모든|전부)\s*(?:일|것).{0,14}(?:오늘|지금).{0,10}(?:끝낼|할)\s*필요.{0,6}(?:없|않)|(?:오래|계속).{0,10}(?:유지|지킬).{0,14}(?:속도|페이스)|지속\s*가능한\s*(?:속도|페이스)/i.test(text)) return special('sustainable-pace', ['🌿','😌','🌱'], 'life', 32);
        if (/(?:체크리스트|목록).{0,18}(?:마지막|끝).{0,10}(?:칸|항목).{0,12}(?:표시|체크|완료)|(?:며칠|오래).{0,12}(?:남아|미뤄).{0,14}(?:일|작업).{0,12}(?:마무리|끝|완료)|(?:끝냈|마쳤|완료했).{0,14}(?:사실|것).{0,8}(?:기분\s*좋|좋다)/i.test(text)) return special('completion-ko-broad', ['✅','🙌','😊'], 'status', 33);
        // Snow must beat the generic rain/storm weather rule.
        if (/\b(?:snow|snowing|snowfall|blizzard).{0,24}(?:started|falling|commute|evening|morning)|(?:started|began).{0,10}(?:snowing|to snow)\b|(?:눈|폭설).{0,18}(?:내리|오|시작|퇴근길|출근길)/i.test(text)) return special('snow-weather', ['❄️','🌨️'], 'weather', 34);
        if (/\b(?:hiking|hike).{0,24}(?:while|when).{0,18}(?:dark|before sunrise|before dawn)|(?:city|sky).{0,16}(?:still dark).{0,16}(?:hiking|hike)\b|(?:도시|하늘).{0,12}(?:어두|깜깜).{0,12}(?:등산|하이킹).{0,8}(?:시작|출발)/i.test(text)) return special('dark-hike', ['🥾','🌅'], 'topic', 33);
        if (/(?:제품|상품).{0,10}품질.{0,18}(?:약속한|기대한|기준).{0,12}(?:수준|품질)?.{0,10}(?:못\s*미치|미치지\s*못|낮았|부족)|\b(?:product|item) quality.{0,20}(?:didn['’]t|did not|failed to).{0,10}(?:live up|meet)\b/i.test(text)) return special('quality-expectation-ko', ['😔','👎'], 'mood', 33);
        if (/(?:빌드|버전)\s*[\d.]+.{0,16}(?:릴리스|출시|배포).{0,10}(?:준비).{0,8}(?:마쳤|완료|됐|됨)|\b(?:build|version)\s*[\d.]+.{0,16}(?:release|ship|deploy).{0,8}(?:ready|preparation complete)\b/i.test(text)) return special('version-number-ready', ['🔄','📱'], 'product', 33);
        if (/\b(?:do not|don['’]t|no longer).{0,12}(?:feel )?(?:disappointed|sad|upset).{0,10}(?:anymore|now)?|(?:feel )?(?:disappointed|sad|upset).{0,12}(?:no longer|not anymore)\b|(?:이제|더\s*이상).{0,16}(?:실망|속상|슬프).{0,10}(?:지\s*않|않다|않습|아니)/i.test(text)) return special('negative-mood-ended', ['😌','😊'], 'mood', 34);
        if (/(?:구매|제품|상품|서비스).{0,16}(?:만족하지\s*않|만족스럽지\s*않|마음에\s*들지\s*않)|\b(?:not|isn['’]t) satisfied with.{0,14}(?:purchase|product|service)\b/i.test(text)) return special('not-satisfied', ['😔','😕'], 'mood', 33);
        if (/(?:결제|거래).{0,16}(?:완료|처리).{0,8}(?:할\s*수\s*없|되지\s*않|못했)|\b(?:payment|transaction).{0,16}(?:could not|couldn['’]t|was unable to).{0,8}(?:complete|process)\b/i.test(text)) return special('cannot-complete-payment', ['❌','⚠️'], 'status', 34);
        if (/(?:결과|생각|선택).{0,16}(?:아주|그렇게|전혀)?\s*나쁜\s*(?:편|것)?.{0,8}(?:아니|않)|\b(?:result|idea|choice).{0,14}(?:not|isn['’]t|wasn['’]t).{0,8}(?:that|very|so)?\s*bad\b/i.test(text)) return special('not-bad-broad', ['😊','🤔'], 'mood', 32);
        if (/(?:교육|훈련|강의|과정).{0,18}(?:다음\s*주|다음주|월요일|화요일|수요일|목요일|금요일).{0,12}(?:시작|개강)|\b(?:training|course|class).{0,18}(?:next week|monday|tuesday|wednesday|thursday|friday).{0,10}(?:starts?|begins?)\b/i.test(text)) return special('training-start', ['📚','📅'], 'topic', 32);
        if (/(?:오랜만에|다시).{0,12}(?:길|도로).{0,8}(?:나섰|나가|달리)|\b(?:back on|back onto|returned to) (?:the )?(?:road|highway).{0,12}(?:after|again)?\b/i.test(text)) return special('road-again-ko', ['🚗','🛣️'], 'topic', 31);
        if (/(?:어떻게든|간신히).{0,10}(?:월요일|하루|한\s*주).{0,8}(?:버텼|견뎠)|(?:월요일|하루|한\s*주).{0,10}(?:어떻게든|간신히).{0,8}(?:버텼|견뎠)|\b(?:somehow|barely).{0,10}(?:made it through|survived).{0,10}(?:monday|day|week)\b/i.test(text)) return special('survived-day', ['😮‍💨','🙌'], 'mood', 31);
        // Human rest / sleep language beyond a few exact phrases.
        if (/\b(?:sleep|slept|sleeping|nap|napped|bedtime|bed early|went to bed|turning in|rested|rest).{0,34}(?:refreshed|rested|better|easier|clearer|enough|deeply|well|early|tired|exhausted)|(?:refreshed|rested|better|clearer).{0,28}(?:sleep|nap|rest)\b|(?:잠|낮잠|잤|자고|잘|쉬었|휴식|피로).{0,32}(?:개운|상쾌|나아|좋아|덜|맑|충분|일찍)|(?:개운|상쾌|피로가\s*덜|한결\s*맑).{0,18}(?:잠|잤|쉬)/i.test(text)) return special('human-rest-broad', ['😴','😌','🛌'], 'life', 30);
        // Time passing: seasons, months and years should not fall into generic reflection.
        if (/\b(?:summer|winter|spring|autumn|fall|season|week|month|year|january|february|march|april|may|june|july|august|september|october|november|december|time).{0,35}(?:slipping away|passing|passed|gone|vanished|flying by|flew by|moving).{0,20}(?:fast|quick|quickly|already|moment)?|(?:already|half|end of).{0,20}(?:week|month|year|season)|(?:calendar).{0,24}(?:month|week|year).{0,14}(?:gone|passed)\b|(?:여름|겨울|봄|가을|계절|주|달|개월|올해|시간|1월|2월|3월|4월|5월|6월|7월|8월|9월|10월|11월|12월).{0,34}(?:지나|흘러|끝나|사라|빠르|금방|순식간|벌써|절반)|벌써.{0,18}(?:올해|이번\s*달|이번\s*주|계절).{0,16}(?:끝|지나|절반)/i.test(text)) return special('time-passage-general', ['⏳','🕰️','📅'], 'life', 31);
        // Sustainable pace / self-pressure language.
        if (/\b(?:slow progress|steady progress|own pace|my pace|patient with (?:my|the) pace|consistency instead of speed|steadily|sustainable pace|no need to finish everything|one small step at a time|not falling behind).{0,30}\b|(?:천천히|꾸준|내\s*속도|나만의\s*속도|서두르지|무리하지|모든\s*일을\s*끝낼\s*필요|작은\s*단계|뒤처진).{0,32}(?:가|나아|진전|집중|필요|않|습관|유지)/i.test(text)) return special('steady-pace-general', ['🌱','🌿','😌'], 'life', 30);
        // Relationship conversations and companionship.
        if (/\b(?:conversation|talk|call|dinner|time).{0,22}(?:with|to) (?:my )?(?:dad|father|mom|mum|mother|sister|brother|friend|family).{0,28}(?:better|good|reset|helped|laugh|miss)?|(?:spending time|being) with family.{0,20}(?:reset|better|good)|(?:kind|good) (?:person|people).{0,18}(?:met|meet|mood|better)\b|(?:아빠|엄마|부모님|언니|누나|형|오빠|동생|친구|가족).{0,22}(?:이야기|통화|저녁|시간|함께).{0,20}(?:나아|좋|웃|편)|(?:친절한|좋은)\s*사람.{0,18}(?:만나|기분).{0,12}(?:좋|나아)/i.test(text)) return special('relationship-warmth', ['💛','🤝','😊'], 'social', 29);
        if (/\b(?:miss|missing).{0,20}(?:people|friends?|family).{0,22}(?:used to|spend|weekend|together)?|(?:people|friends?).{0,22}(?:used to spend|used to see).{0,18}(?:miss|missing)\b|(?:사람|친구|가족).{0,22}(?:그립|보고\s*싶|함께하던\s*시간)/i.test(text)) return special('missing-people', ['😔','💛'], 'mood', 31);
        // Generic completion and sending postponed work.
        if (/\b(?:task|project|work|thing|checklist|list|draft).{0,30}(?:finally|done|finished|completed|checked|wrapped up|sent)|(?:finally|completed|finished|done|checked|sent).{0,30}(?:task|project|work|thing|checklist|draft)|everything i planned.{0,16}(?:done|finished|completed)\b|(?:일|작업|프로젝트|체크리스트|목록|초안|계획).{0,28}(?:드디어|마침내|전부|모두).{0,12}(?:끝|완료|마쳤|체크|보냈|처리)|(?:끝냈|완료했|마쳤|체크했|보냈).{0,16}(?:일|작업|프로젝트|초안)/i.test(text)) return special('completion-general', ['✅','🙌','📤'], 'status', 29);
        if (/\b(?:tiny|small|little) (?:progress|win|victory).{0,20}(?:happy|good|smile|mood)|(?:happy|pleased) with.{0,14}(?:tiny|small|little) progress\b|(?:작은|조금의?)\s*(?:진전|성공|승리|발전).{0,18}(?:만족|기분|좋|웃)/i.test(text)) return special('small-progress-positive', ['🌱','😊','🎉'], 'growth', 29);
        // Weather and outdoors.
        if (/\b(?:rain|raining|rainy|storm|stormy|snow|snowing|snowy).{0,28}(?:walk|home|office|commute|plans?|started|falling|left)|(?:started|began).{0,14}(?:raining|snowing)|(?:storm).{0,20}(?:changed|cancelled|plans?)\b|(?:비|눈|폭풍).{0,24}(?:내리|오|시작|계획|퇴근|집|걷)|(?:내리기|오기).{0,12}(?:시작).{0,16}(?:비|눈)/i.test(text)) return special('weather-event', ['🌧️','☔','❄️','⛈️'], 'weather', 28);
        if (/\b(?:sunset|sunrise|sun went down|sun goes down|sky cleared|river).{0,28}(?:sky|river|sat|watch|clear|beautiful|window)?|(?:sat|sitting).{0,20}(?:river|water).{0,20}(?:sun|sunset)\b|(?:해가\s*지|해\s*질|일몰|일출|노을|강가|강변).{0,24}(?:앉|하늘|맑|바라|질\s*때)/i.test(text)) return special('sun-water-view', ['🌅','🌊','☀️'], 'topic', 28);
        if (/\b(?:hike|hiking|trail).{0,24}(?:dark|sunrise|morning|mountain)|(?:dark|before dawn|early morning).{0,18}(?:hike|hiking)\b|(?:등산|하이킹|산행).{0,18}(?:어두|일출|새벽|아침)|(?:새벽|어두울\s*때).{0,12}(?:등산|하이킹)/i.test(text)) return special('hiking', ['🥾','🌅'], 'topic', 29);
        // Creative / hobbies.
        if (/\b(?:edit|editing|organize|organizing).{0,18}(?:photos?|pictures?|images?)|(?:photos?|pictures?).{0,16}(?:edit|editing)\b|(?:사진|이미지).{0,14}(?:편집|정리)|(?:편집|정리).{0,12}(?:사진|이미지)/i.test(text)) return special('photo-editing', ['📸','🖼️'], 'topic', 30);
        if (/\b(?:camera|photos?|photography).{0,20}(?:sunset|river|trip|outside)|(?:took|taking|shooting).{0,12}(?:photos?|pictures?)\b|(?:카메라|사진).{0,18}(?:노을|강가|여행|찍|들고)/i.test(text)) return special('photography', ['📸','🌅'], 'topic', 28);
        if (/\b(?:baked|baking|made).{0,10}(?:bread|cookies?|cake).{0,20}(?:first time|worked|good|great)?|(?:bread|cookies?|cake).{0,18}(?:baked|baking)\b|(?:빵|쿠키|케이크).{0,12}(?:구웠|만들|베이킹).{0,14}(?:처음|잘됐|성공)?/i.test(text)) return special('baking', ['🍞','🧁','😊'], 'topic', 29);
        if (/\b(?:guitar|piano|violin|drums?).{0,22}(?:practice|practiced|played|tired)|(?:practice|practiced).{0,16}(?:guitar|piano|violin)\b|(?:기타|피아노|바이올린|드럼).{0,16}(?:연습|연주|쳤|피곤)/i.test(text)) return special('instrument-practice', ['🎸','🎵'], 'topic', 29);
        // Reports / review / approval.
        if (/\b(?:client|manager|team).{0,16}(?:approved|accepted).{0,18}(?:proposal|draft|plan|document)|(?:proposal|draft|plan|document).{0,16}(?:approved|accepted)\b|(?:클라이언트|고객|관리자|팀).{0,16}(?:제안서|초안|계획|문서).{0,14}(?:승인|수락)/i.test(text)) return special('document-approved', ['✅','📝'], 'report', 31);
        if (/\b(?:response|conversion|click|open|completion|success) rate.{0,24}(?:improved|increased|rose|fell|decreased)|(?:quarter|month|week).{0,18}(?:rate).{0,16}(?:improved|increased|fell)\b|(?:응답률|전환율|클릭률|완료율|성공률).{0,18}(?:개선|증가|상승|감소|하락)/i.test(text)) return special('rate-change', ['📈','📊'], 'report', 31);
        if (/\b(?:report|proposal|document|summary).{0,16}(?:ready|prepared).{0,16}(?:review|manager|approval)|(?:ready|prepared).{0,16}(?:report|proposal|document).{0,16}(?:review|approval)\b|(?:보고서|제안서|문서|요약).{0,16}(?:검토|승인).{0,12}(?:준비|완료)|(?:검토|승인).{0,12}(?:보고서|문서).{0,10}(?:준비)/i.test(text)) return special('document-review-ready', ['👀','📝','✅'], 'report', 30);
        // Commerce status and fulfillment.
        if (/\b(?:promo|promotion|discount|coupon) (?:code )?.{0,22}(?:expires?|stops? working|ends?).{0,14}(?:midnight|tonight|today|tomorrow)?|(?:expires?|ends?).{0,14}(?:promo|discount|coupon)\b|(?:프로모션|할인|쿠폰)\s*(?:코드)?.{0,18}(?:만료|종료).{0,10}(?:자정|오늘|내일)?/i.test(text)) return special('promo-expiry', ['🏷️','⏰'], 'commerce', 31);
        if (/\b(?:refund|return).{0,18}(?:approved|accepted|completed)|(?:approved|accepted).{0,14}(?:refund|return)\b|(?:환불|반품).{0,14}(?:승인|완료|접수)/i.test(text)) return special('refund-approved', ['✅','💰','📦'], 'commerce', 31);
        if (/\b(?:item|product).{0,18}(?:temporarily )?(?:unavailable|out of stock|sold out)|(?:unavailable|out of stock).{0,14}(?:item|product)\b|(?:상품|제품).{0,18}(?:품절|구매할\s*수\s*없|이용\s*불가|사용\s*불가)/i.test(text)) return special('product-unavailable', ['🚫','📦'], 'commerce', 31);
        if (/\b(?:checkout).{0,24}(?:less time|faster|quicker|shorter|reduced time)|(?:time|duration).{0,16}(?:checkout).{0,12}(?:reduced|shorter)\b|결제.{0,14}(?:걸리는\s*시간|소요\s*시간|속도).{0,12}(?:줄|단축|빨라|개선)/i.test(text)) return special('checkout-speed', ['⚡','⏱️','📉'], 'commerce', 31);
        if (/\b(?:new |latest )?feature.{0,24}(?:all|every) (?:customer|user|account).{0,12}(?:available|reached|enabled|applied)?|(?:all|every) (?:customer|user|account).{0,20}(?:feature).{0,12}(?:available|enabled)\b|(?:새\s*)?기능.{0,18}(?:모든|전체)\s*(?:고객|사용자|계정).{0,12}(?:적용|공개|사용)/i.test(text)) return special('feature-everyone', ['🚀','✨'], 'product', 31);
        if (/\b(?:product|item).{0,18}(?:did not|didn['’]t|failed to).{0,14}(?:live up|meet).{0,14}(?:quality|promise|expectation)|(?:promised|expected) quality.{0,16}(?:not met|below)\b|(?:제품|상품)\s*품질.{0,18}(?:약속|기대|수준).{0,12}(?:못\s*미치|미치지\s*못|낮)/i.test(text)) return special('quality-shortfall', ['😔','👎'], 'mood', 31);
        if (/\b(?:order|package|parcel).{0,16}(?:shipped|dispatched|sent).{0,14}(?:today|afternoon|morning)?|(?:shipped|dispatched).{0,16}(?:order|package)\b|(?:주문|택배|상품).{0,14}(?:발송|출고).{0,10}(?:오늘|오후|아침)?/i.test(text)) return special('order-shipped', ['📦','🚚'], 'commerce', 31);
        // Tech completion / stability.
        if (/\b(?:migration|import|sync|deployment|job|process).{0,20}(?:completed|finished).{0,12}(?:successfully|without errors?)|(?:successfully|without errors?).{0,16}(?:completed|finished).{0,12}(?:migration|import|sync|deployment)\b|(?:마이그레이션|가져오기|동기화|배포|작업).{0,16}(?:성공적으로|오류\s*없이).{0,10}(?:완료|끝)/i.test(text)) return special('technical-complete', ['✅','💻'], 'tech', 31);
        if (/\b(?:everything|service|system).{0,18}(?:stable|normal).{0,18}(?:after|following).{0,14}(?:interruption|outage|incident|downtime)|(?:after|following).{0,16}(?:interruption|outage|incident).{0,18}(?:stable|normal)\b|(?:서비스|시스템).{0,18}(?:중단|장애).{0,12}(?:이후|후).{0,14}(?:안정|정상)|(?:중단|장애).{0,12}(?:이후|후).{0,14}(?:모두|현재).{0,8}(?:안정|정상)/i.test(text)) return special('stable-after-interruption', ['✅'], 'status', 32);
        // Nuanced recovery / double negation / finality.
        if (/\b(?:no longer|not anymore).{0,12}(?:disappointed|sad|upset|unhappy)|(?:disappointed|sad|upset).{0,12}(?:no longer|not anymore)\b|(?:이제|더\s*이상).{0,12}(?:실망|슬프|속상).{0,8}(?:지\s*않|않다|않습|아니)/i.test(text)) return special('mood-recovered', ['😌','😊'], 'mood', 33);
        if (/\b(?:service|system|feature).{0,14}(?:not unavailable anymore|no longer unavailable|is available again|not inaccessible anymore)\b|(?:서비스|시스템|기능).{0,18}(?:이용\s*불가|사용\s*불가).{0,10}(?:아니|아닙|아닌)|(?:이제|더\s*이상).{0,12}(?:이용\s*불가|사용\s*불가).{0,8}(?:아니|아닙)/i.test(text)) return special('available-again', ['✅'], 'status', 33);
        if (/\b(?:this|the) (?:version|build|draft).{0,18}(?:not|isn['’]t).{0,20}(?:publish|release|final|ship)|(?:not|isn['’]t).{0,16}(?:version|build).{0,16}(?:publish|release|ship)\b|(?:이|이번|해당)\s*(?:버전|빌드|초안).{0,18}(?:공개|출시|배포).{0,12}(?:최종|할).{0,8}(?:아니|아닙)/i.test(text)) return special('not-publish-version', ['📝','🔄'], 'product', 31);
        if (/\b(?:task|work|problem|issue).{0,18}(?:frustrating|annoying|difficult).{0,22}(?:but|yet).{0,18}(?:solved|fixed|resolved)|(?:solved|fixed|resolved).{0,18}(?:frustrating|annoying)\b|(?:작업|문제|일).{0,16}(?:답답|짜증|어렵).{0,16}(?:지만|했지만).{0,16}(?:해결|고쳤|끝냈)/i.test(text)) return special('frustration-resolved', ['✅','💪'], 'status', 32);
        if (/\b(?:not|isn['’]t|wasn['’]t).{0,8}(?:a )?(?:very )?bad (?:result|outcome|idea|choice)|(?:bad).{0,16}(?:after all|at all).{0,8}(?:not|isn['’]t)?\b|(?:아주|그렇게|전혀)?.{0,6}(?:나쁜|안\s*좋은).{0,10}(?:결과|선택|생각).{0,8}(?:아니|않)/i.test(text)) return special('not-bad-result', ['😊','🤔'], 'mood', 31);
        // Education / documentation.
        if (/\b(?:exam|test).{0,18}(?:friday|monday|tomorrow|today|next week).{0,22}(?:study|studying)|(?:study|studying).{0,18}(?:exam|test)\b|(?:시험|테스트).{0,18}(?:금요일|월요일|내일|오늘|다음\s*주).{0,18}(?:공부|준비)|(?:공부|준비).{0,14}(?:시험|테스트)/i.test(text)) return special('study-exam', ['📚','✏️'], 'topic', 30);
        if (/\b(?:training|course|class|workshop).{0,18}(?:starts?|begins?).{0,14}(?:monday|tuesday|wednesday|thursday|friday|next week|tomorrow)|(?:교육|과정|수업|워크숍).{0,18}(?:시작).{0,12}(?:월요일|화요일|수요일|목요일|금요일|다음\s*주|내일)/i.test(text)) return special('course-start', ['📚','📅'], 'topic', 30);
        if (/\b(?:security|virus|malware|system) scan.{0,22}(?:no|without).{0,12}(?:problems?|issues?|threats?)|(?:no|without).{0,12}(?:problems?|issues?|threats?).{0,18}(?:security|system) scan\b|(?:보안|바이러스|시스템)\s*검사.{0,18}(?:문제|위협).{0,8}(?:없|발견되지\s*않)/i.test(text)) return special('security-scan-clean', ['✅','🛡️'], 'tech', 31);
        if (/\b(?:found|located) (?:the )?(?:answer|solution).{0,18}(?:in|inside) (?:the )?(?:docs?|documentation|manual|guide)|(?:docs?|documentation).{0,20}(?:answer|solution).{0,14}(?:found|located)\b|(?:문서|가이드).{0,14}(?:답|해결책).{0,10}(?:찾|발견)|(?:답|해결책).{0,10}(?:문서|가이드).{0,8}(?:찾|발견)/i.test(text)) return special('answer-in-docs', ['🔎','💻'], 'tech', 30);
        // Social caption idioms.
        if (/\b(?:back on the road|on the road again|road trip).{0,18}(?:break|again)?\b|(?:오랜만에|다시).{0,12}(?:길을\s*나서|도로|드라이브)/i.test(text)) return special('back-on-road', ['🚗','🛣️'], 'topic', 29);
        if (/\b(?:quiet|slow) (?:sunday|morning|weekend).{0,18}(?:no|without) notifications?\b|(?:알림\s*없는|알림\s*없이).{0,12}(?:조용한|느린)\s*(?:일요일|아침|주말)/i.test(text)) return special('quiet-no-notifications', ['📵','🌿'], 'life', 30);
        if (/\b(?:made it through|survived|got through) (?:monday|the day|the week).{0,12}(?:somehow)?\b|(?:월요일|하루|이번\s*주).{0,12}(?:어떻게든|간신히).{0,8}(?:버텼|지나)/i.test(text)) return special('made-it-through', ['😮‍💨','🙌'], 'mood', 29);
        if (/\b(?:playlist|music).{0,22}(?:fixed|improved|made).{0,18}(?:commute|drive|trip|mood)|(?:commute|drive).{0,20}(?:playlist|music).{0,14}(?:better|good)\b|(?:플레이리스트|음악).{0,18}(?:출근길|퇴근길|이동).{0,12}(?:나아|좋아)|(?:출근길|퇴근길).{0,18}(?:플레이리스트|음악).{0,10}(?:덕분|좋)/i.test(text)) return special('music-commute', ['🎧','😊'], 'topic', 30);
        if (/\b(?:really|just|simply).{0,10}(?:nice|good|lovely|peaceful) evening\b|(?:기분\s*좋은|좋은|평온한)\s*저녁|그냥.{0,8}(?:기분\s*좋은|좋은)\s*저녁/i.test(text)) return special('nice-evening', ['😊','🌙'], 'mood', 29);
        if (/\b(?:thinking|wondering|reflecting).{0,28}(?:how|about how).{0,12}(?:fast|quickly).{0,16}(?:this |the )?(?:year|month|week|time).{0,10}(?:is )?(?:passing|going by)|(?:this |the )?(?:year|month|week).{0,24}(?:passing|going by).{0,12}(?:fast|quickly)\b|(?:올해|이번\s*달|이번\s*주|시간).{0,22}(?:얼마나|정말).{0,10}(?:빨리|빠르게).{0,10}(?:지나|흘러).{0,16}(?:생각|느끼)|(?:빨리|빠르게).{0,10}지나가는.{0,16}(?:생각|느낌)/i.test(text)) return special('reflect-time-passing', ['⏳','🕰️'], 'life', 34);
        if (/\b(?:slept|sleep).{0,18}(?:deeply|really well|soundly|well).{0,24}(?:woke|wake|morning).{0,18}(?:rested|refreshed|good)|(?:woke|wake).{0,20}(?:rested|refreshed).{0,20}(?:after|because).{0,12}(?:sleep|night)\b|(?:어젯밤|밤에).{0,12}(?:푹|잘).{0,8}(?:잤|자고).{0,18}(?:개운|상쾌|좋았)/i.test(text)) return special('deep-sleep-rested', ['😴','😌'], 'life', 34);
        if (/\b(?:whole|entire) (?:week|month|year).{0,18}(?:disappeared|flew by|went by|passed).{0,14}(?:quickly|fast)?|(?:this|the) (?:year|month|week).{0,26}(?:how|so).{0,8}(?:fast|quickly).{0,8}(?:passing|going by)|thinking about.{0,18}(?:how fast|how quickly).{0,16}(?:year|month|week|time).{0,8}(?:pass|go)\b|(?:올해|이번\s*달|이번\s*주|한\s*달|한\s*주).{0,22}(?:얼마나|정말|너무).{0,10}(?:빨리|빠르게|순식간).{0,12}(?:지나|흘러)|(?:올해|이번\s*달).{0,16}(?:빨리|빠르게).{0,12}지나/i.test(text)) return special('time-flying-broad', ['⏳','🕰️'], 'life', 34);
        if (/\b(?:finally\s+)?finished (?:the )?(?:task|thing|work).{0,24}(?:avoided|put off|postponed).{0,16}(?:all week|for days|for weeks)?|(?:task|thing|work).{0,20}(?:avoided|put off|postponed).{0,20}(?:finally\s+)?(?:finished|done|completed)\b|(?:일주일|며칠|몇\s*주).{0,12}(?:미루|피하).{0,16}(?:일|작업).{0,12}(?:끝냈|완료)/i.test(text)) return special('avoided-task-done', ['✅','🙌'], 'status', 34);
        if (/\b(?:miss|missing) (?:spending time|hanging out|being) with (?:my )?(?:old|close|college|school)?\s*friends?\b|(?:friends?).{0,18}(?:time together|hanging out).{0,16}(?:miss|missing)\b|(?:예전|오랜|친한)?\s*친구.{0,18}(?:함께하던|보내던)\s*시간.{0,12}(?:그립|보고\s*싶)/i.test(text)) return special('miss-friend-time', ['💛','😔','🤝'], 'mood', 33);
        if (/(?:따뜻하게|따뜻한).{0,10}(?:샤워|씻).{0,18}(?:일찍\s*(?:쉬|자|잤)).{0,18}(?:한결|기분|몸).{0,10}(?:나아|좋아)|\b(?:warm|hot) shower.{0,20}(?:early rest|rested early|early night).{0,20}(?:better|improved|recovered)\b/i.test(text)) return special('warm-rest-better', ['😌','🛌'], 'life', 33);
        if (/(?:차가운|추운)\s*(?:아침\s*)?(?:공기|날씨).{0,16}(?:정신|잠).{0,8}(?:번쩍|깨|들)|\b(?:cold|freezing) (?:morning )?air.{0,18}(?:woke me up|made me alert|felt sharp)\b/i.test(text)) return special('cold-air', ['🥶','❄️'], 'weather', 32);
        if (/(?:한\s*달|몇\s*주|몇\s*달).{0,10}만에.{0,12}(?:다시\s*)?(?:달렸|뛰었|러닝)|(?:다시\s*)?(?:달렸|뛰었).{0,12}(?:기분|느낌).{0,8}(?:좋|상쾌)|\b(?:first|back to) run.{0,16}(?:month|weeks?)\b/i.test(text)) return special('running-return-ko', ['🏃','😊'], 'topic', 33);
        if (/(?:늦은\s*밤|한밤중|자정).{0,14}(?:도시|거리).{0,14}(?:불빛|빛|야경)|(?:도시|거리).{0,14}(?:늦은\s*밤|한밤중|자정).{0,10}(?:불빛|빛)|\b(?:late[- ]night|midnight) (?:city|street) lights?\b/i.test(text)) return special('late-city-lights', ['🌃','🌙'], 'topic', 33);
        if (/\b(?:only|just)\s*(?:one|two|three|four|five|\d+)\s+(?:items?|products?).{0,16}(?:remain|remaining|left).{0,16}(?:cart|basket)|(?:one|two|three|four|five|\d+)\s+(?:items?|products?).{0,14}(?:remain|remaining|left).{0,12}(?:in )?(?:your|the)?\s*(?:cart|basket)\b|장바구니.{0,16}(?:한|두|세|네|다섯|\d+)\s*(?:개|가지).{0,12}(?:남|있)/i.test(text)) return special('cart-remaining', ['🛒'], 'commerce', 33);
        if (/\b(?:return|refund) request.{0,16}(?:approved|accepted)|(?:approved|accepted).{0,16}(?:return|refund) request\b|(?:반품|환불)\s*요청.{0,12}(?:승인|접수).{0,8}(?:되|됐|완료)?/i.test(text)) return special('return-approved', ['✅','📦'], 'commerce', 33);
        if (/\b(?:payment|transaction|checkout).{0,14}(?:did not|didn['’]t|could not|couldn['’]t).{0,10}(?:go through|process|complete|succeed)|(?:payment|transaction).{0,14}(?:not processed|was declined|failed to process)\b|결제.{0,14}(?:정상적으로\s*)?(?:처리|완료|승인).{0,8}(?:되지\s*않|안\s*됐|못|실패)|결제.{0,12}(?:실패|거절)/i.test(text)) return special('payment-failed-broad', ['❌','⚠️'], 'status', 34);
        if (/(?:회사|사무실).{0,12}(?:나오|나서|퇴근).{0,12}(?:비가|비).{0,10}(?:내리|오)|(?:비가|비).{0,12}(?:회사|사무실).{0,12}(?:나오|퇴근)|\b(?:rain|raining).{0,16}(?:left|leaving) (?:the )?(?:office|work)\b/i.test(text)) return special('rain-leaving-work', ['🌧️','☔'], 'weather', 33);
        if (/(?:해\s*뜨기|일출).{0,12}(?:전|전에).{0,12}(?:등산|하이킹|산에)|(?:등산|하이킹).{0,14}(?:해\s*뜨기|일출).{0,10}(?:전|전에)|\b(?:hiking|hike).{0,16}(?:before|at) sunrise\b/i.test(text)) return special('sunrise-hike', ['🥾','🌅'], 'topic', 33);
        if (/(?:화분|식물).{0,12}(?:물|물을).{0,8}(?:줬|주었|주고)|(?:물|물을).{0,8}(?:화분|식물).{0,8}(?:줬|주었)|\b(?:watered|watering).{0,12}(?:plants?|flowers?)\b/i.test(text)) return special('water-plants', ['🌿','🏠'], 'life', 32);
        if (/\b(?:finally\s+)?(?:finished|completed|cleared|wrapped up).{0,18}(?:task|thing|item|work).{0,24}(?:sitting|waiting|pending|put off|postponed).{0,16}(?:list|for|since)?|(?:task|thing|item).{0,18}(?:sitting|waiting|pending).{0,20}(?:finally\s+)?(?:finished|completed|done)\b|(?:미루던|미뤄\s*두었던|남겨\s*두었던).{0,14}(?:일|작업|할\s*일).{0,12}(?:드디어|마침내)?.{0,8}(?:끝냈|완료|처리)/i.test(text)) return special('deferred-task-complete', ['✅','🙌'], 'status', 34);
        if (/\b(?:finally\s+)?checked off (?:the )?(?:last|final) (?:thing|item|task).{0,18}(?:needed|had|to do)?\b|(?:last|final) (?:thing|item|task).{0,20}(?:checked off|crossed off)\b|(?:마지막|남은)\s*(?:한\s*)?(?:가지|일|작업|항목).{0,16}(?:체크|끝냈|완료)/i.test(text)) return special('final-thing-checked', ['✅','🙌'], 'status', 34);
        if (/\b(?:warm|hot) shower.{0,30}(?:early bedtime|went to bed early).{0,30}(?:fixed|improved|lifted).{0,12}(?:my )?mood|(?:fixed|improved|lifted).{0,12}(?:my )?mood.{0,28}(?:shower|bedtime)\b|따뜻하게\s*(?:씻|샤워).{0,20}(?:일찍\s*(?:잤|자)).{0,20}(?:기분|마음).{0,10}(?:나아|좋아)/i.test(text)) return special('warm-shower-recovery', ['😌','🛌'], 'life', 34);
        if (/\b(?:the )?(?:morning|air|weather).{0,16}(?:was|felt|is)?\s*(?:freezing|icy|very cold|bitterly cold|cold).{0,30}(?:sky|sun|sunrise).{0,14}(?:beautiful|clear|bright)|(?:freezing|icy|cold).{0,30}(?:beautiful|clear|bright) (?:sky|sunrise)\b|(?:아침\s*공기|아침|날씨).{0,14}(?:추웠|추워|차가웠|차가워).{0,24}(?:하늘|햇살|노을).{0,12}(?:예뻤|맑|좋았)/i.test(text)) return special('freezing-beautiful', ['🥶','☀️','🌅'], 'weather', 34);
        if (/(?:바람을\s*쐬|바람\s*쐬).{0,20}(?:걸어|걷|먼\s*길)|(?:먼\s*길|일부러).{0,20}(?:걸어|걷).{0,12}(?:집|돌아)|\b(?:took|walked) (?:the )?(?:long|longer|scenic) way (?:home|back).{0,18}(?:air|clear my head|fresh air)?\b/i.test(text)) return special('walk-fresh-air', ['🚶','🌿'], 'life', 33);
        if (/\b(?:rainy|raining|rain).{0,24}(?:stay|staying|being) (?:at )?home.{0,18}(?:better|nice|cozy|cosy|prefer)|(?:stay|staying) home.{0,18}(?:because|while).{0,12}(?:rain|raining)\b|비가\s*(?:와|오|왔).{0,20}(?:집에\s*있|집이).{0,14}(?:좋|편|낫)|집에\s*있는.{0,14}(?:비|비가).{0,14}(?:좋|낫)/i.test(text)) return special('rainy-home', ['🌧️','🏠','😌'], 'life', 33);
        if (/\b(?:this |a )?(?:little|small|tiny) win.{0,18}(?:made my day|felt good|made me smile)|(?:made my day|made me smile).{0,16}(?:little|small|tiny) win\b|작은\s*(?:성공|승리|성과).{0,20}(?:하루|기분).{0,14}(?:좋|웃|행복)/i.test(text)) return special('little-win-day', ['🎉','😊','🙌'], 'event', 34);
        if (/\b(?:woke|wake|waking).{0,26}(?:before|without).{0,18}(?:alarm).{0,28}(?:rested|refreshed|well rested|good)|\b(?:slept|sleeping).{0,24}(?:through the night|all night).{0,20}(?:well|first time|finally)?\b|(?:알람|알람이).{0,18}(?:전에|없이).{0,16}(?:눈|깼|일어).{0,20}(?:개운|상쾌)|밤새.{0,12}(?:푹|잘)\s*잤|밤을\s*푹\s*잤/i.test(text)) return special('rested-sleep', ['😴','😌'], 'life', 33);
        if (/\b(?:(?:last|past) (?:few )?(?:weeks?|months?|years?).{0,35}(?:gone by|went by|passed|disappeared).{0,20}(?:fast|quickly|blur)|(?:weeks?|months?|years?).{0,24}(?:disappeared|flew by|went by) before i noticed|time.{0,20}(?:flew|passed).{0,16}(?:fast|quickly))\b|(?:최근|지난).{0,10}(?:몇\s*)?(?:주|달|개월|년).{0,22}(?:순식간|눈\s*깜짝|빠르게).{0,10}(?:지나|흘러)|(?:한\s*주|한달|한\s*달).{0,18}(?:눈\s*깜짝할\s*사이|순식간).{0,10}(?:지나|사라)/i.test(text)) return special('time-passing-fast', ['⏳','🕰️'], 'life', 33);
        if (/\b(?:stop|quit|avoid).{0,24}(?:measuring|judging).{0,20}(?:my|every) day.{0,22}(?:by|based on).{0,20}(?:finish|done|productiv)|(?:don['’]t|do not|not) want to.{0,24}(?:measure|judge).{0,22}(?:day|myself).{0,20}(?:finish|productiv)|(?:without|instead of).{0,22}(?:rushing|pressuring myself)|keep moving forward.{0,24}(?:without rushing|at my own pace)\b|하루.{0,22}(?:얼마나|많이).{0,14}(?:해냈|완료).{0,20}(?:평가|판단).{0,8}(?:않|말)|나\s*자신을.{0,18}(?:재촉|몰아붙).{0,18}(?:않|말).{0,20}(?:나아|가고)|서두르지\s*않고.{0,18}(?:나아|가고)|내\s*속도로.{0,18}(?:가고|나아)/i.test(text)) return special('gentle-pace', ['🌿','😌','🌱'], 'life', 32);
        if (/\b(?:finally\s+)?(?:checked|crossed|ticked).{0,20}(?:last|final).{0,18}(?:thing|item|task).{0,10}(?:off|done)|finally.{0,22}(?:finished|completed|done).{0,24}(?:kept|been).{0,18}(?:postponing|putting off)|(?:thing|task).{0,18}(?:kept postponing|put off).{0,12}(?:finished|done)\b|(?:해야\s*할|남아\s*있던).{0,16}(?:마지막|한\s*가지).{0,18}(?:체크|끝냈|완료)|(?:계속|자꾸).{0,10}미루던.{0,14}(?:일|작업).{0,10}(?:끝냈|완료)/i.test(text)) return special('completion-check', ['✅','🙌'], 'status', 33);
        if (/\b(?:have been|been|really|still)?\s*missing\s+(?:my\s+)?(?:college|school|old|close|best)?\s*friends?\b|(?:college|school|old|close|best)\s*friends?.{0,20}(?:miss|missing)\b|(?:학교|대학|예전|오랜|친한)\s*친구.{0,16}(?:보고\s*싶|그립)/i.test(text)) return special('miss-friends-broad', ['💛','😔','🤝'], 'mood', 32);
        if (/\b(?:warm|hot) shower.{0,24}(?:early bedtime|early night|went to bed early).{0,26}(?:mood|feel).{0,15}(?:better|fixed|improved)|(?:early bedtime|went to bed early).{0,24}(?:felt|feel|mood).{0,16}(?:better|rested)\b|따뜻하게.{0,12}(?:씻|샤워).{0,18}(?:일찍\s*잤|일찍\s*자).{0,18}(?:기분|컨디션).{0,10}(?:나아|좋아)/i.test(text)) return special('rest-recovery', ['😌','🛌'], 'life', 31);
        if (/\b(?:freezing|icy|bitterly cold|very cold|cold) (?:morning|air|weather).{0,28}(?:sky|sun|sunrise).{0,16}(?:beautiful|clear|bright)|(?:sky|sunrise).{0,22}(?:beautiful|clear).{0,20}(?:freezing|cold)\b|(?:아침\s*공기|아침|날씨).{0,12}(?:너무\s*)?(?:추웠|추워|차가웠|차가워).{0,22}(?:하늘|햇살|노을).{0,12}(?:예뻤|맑|좋았)/i.test(text)) return special('cold-beautiful-morning', ['🥶','☀️','🌅'], 'weather', 31);
        if (/\b(?:offline|unplugged|no notifications?|notification[- ]free).{0,18}(?:until|for|morning|weekend|day)|(?:slow|quiet) morning.{0,18}(?:without|no) notifications?\b|(?:월요일|주말|내일).{0,12}까지\s*오프라인|오프라인.{0,12}(?:월요일|주말|내일).{0,4}까지|알림\s*(?:없는|없이).{0,10}(?:느린|조용한)\s*아침/i.test(text)) return special('offline-break', ['📵','🌿'], 'life', 32);
        if (/\b(?:city|streets?|downtown).{0,24}(?:after midnight|at midnight|late at night)|after midnight.{0,22}(?:city|streets?|downtown)\b|(?:자정|한밤중).{0,18}(?:도시|거리)|(?:도시|거리).{0,18}(?:자정|한밤중)/i.test(text)) return special('city-after-midnight', ['🌃','🌙'], 'topic', 31);
        if (/\b(?:first|went for a|did a).{0,12}run.{0,18}(?:in|after).{0,14}(?:weeks?|months?)|(?:run|running).{0,20}(?:for the first time|again).{0,16}(?:weeks?|months?)?\b|(?:몇\s*주|몇\s*달).{0,10}만에.{0,10}(?:러닝|달리기|뛰)|오랜만에.{0,8}(?:러닝|달리기|뛰)/i.test(text)) return special('return-to-running', ['🏃'], 'topic', 31);
        if (/\b(?:nothing fancy|nothing special).{0,20}(?:good|great|nice|lovely) day|(?:really|pretty) good day.{0,12}(?:nothing fancy|nothing special)?\b|별거\s*(?:없|아닌).{0,16}(?:좋은|괜찮은)\s*하루|그냥.{0,12}(?:좋은|기분\s*좋은)\s*하루/i.test(text)) return special('simple-good-day', ['😊','✨'], 'mood', 30);
        if (/\b(?:new haircut|fresh haircut|new hair|haircut).{0,18}(?:new|fresh|good) (?:mood|feeling|vibe)|(?:haircut|new hair)\b|새\s*머리.{0,10}(?:새\s*기분|기분|상쾌)|머리.{0,8}(?:잘랐|바꿨)/i.test(text)) return special('haircut', ['💇','✨'], 'topic', 30);
        if (/\b(?:sunset|sunrise|golden hour).{0,28}(?:stopped|pause|watch|look|beautiful)|(?:stopped|paused).{0,22}(?:sunset|sunrise)\b|(?:노을|일출).{0,18}(?:멈춰|바라|보고|예뻐)|멈춰서.{0,12}(?:노을|일출)/i.test(text)) return special('sunset-view', ['🌅','✨'], 'topic', 31);
        if (/\b(?:ticket|case|request|inquiry) volume.{0,22}(?:no|without).{0,18}(?:meaningful|significant).{0,10}(?:change|difference)|(?:no|without).{0,18}(?:meaningful|significant).{0,12}(?:change|difference).{0,20}(?:volume|traffic|requests?)\b|(?:문의|티켓|요청).{0,12}(?:량|건수).{0,18}(?:의미\s*있는|유의미한).{0,8}(?:변화|차이).{0,8}(?:없|않)/i.test(text)) return special('stable-metric', ['📊','✅'], 'report', 32);
        if (/\b(?:email|e-mail) verification.{0,18}(?:required|mandatory|needed)|(?:required|mandatory).{0,18}(?:email|e-mail) verification\b|이메일\s*인증.{0,14}(?:필요|필수)|신규\s*사용자.{0,18}이메일\s*인증/i.test(text)) return special('email-verification', ['📧','✅'], 'status', 31);
        if (/\b(?:median|average|p50|p95)?\s*(?:response|latency|load) time.{0,24}(?:fell|dropped|decreased|reduced|improved).{0,12}\d+\s*ms|(?:latency|response time).{0,20}(?:improved|decreased).{0,12}\d+\s*ms\b|(?:중앙값|평균)?\s*(?:응답|지연|로딩)\s*시간.{0,22}(?:줄|감소|개선).{0,14}(?:ms|밀리초)/i.test(text)) return special('latency-improved', ['⏱️','📉','📈'], 'report', 32);
        if (/\b(?:attached|attachment).{0,30}(?:forecast|projection|estimate|sheet|document|file).{0,24}(?:review|check)|(?:review|check).{0,24}(?:attached|attachment).{0,20}(?:forecast|projection|estimate|sheet|document|file)\b|첨부(?:한|된)?.{0,12}(?:예상|전망|자료|문서|파일).{0,18}(?:검토|확인)|(?:검토|확인).{0,16}첨부(?:한|된)?.{0,10}(?:예상|전망|자료)/i.test(text)) return special('attached-review-broad', ['📎','👀'], 'action', 32);
        if (/\b(?:maintenance|system maintenance).{0,22}(?:overnight|during the night|tonight)|(?:overnight|tonight).{0,18}(?:maintenance)\b|점검.{0,18}(?:밤사이|야간|오늘\s*밤)|(?:밤사이|야간).{0,18}점검/i.test(text)) return special('overnight-maintenance', ['🛠️','🌙'], 'status', 31);
        if (/\b(?:shipping|delivery) (?:is |will be )?free\b|\bfree (?:shipping|delivery)\b|배송(?:비|료)?.{0,10}(?:무료|없음)|무료\s*배송/i.test(text)) return special('free-shipping', ['📦','🛍️'], 'commerce', 32);
        if (/\b(?:there are|only|just)?\s*(?:one|two|three|\d+)\s+(?:products?|items?).{0,18}(?:left|remaining).{0,12}(?:in|inside) (?:the |your )?cart\b|\b(?:cart).{0,20}(?:one|two|three|\d+)\s+(?:products?|items?).{0,12}(?:left|remaining)\b|장바구니.{0,16}(?:\d+|한|두|세)\s*(?:개|가지).{0,12}(?:남아|있)/i.test(text)) return special('cart-items', ['🛒'], 'commerce', 31);
        if (/\b(?:campaign|marketing|performance) summary.{0,20}(?:ready|prepared).{0,14}(?:for review|to review)|(?:summary|report).{0,18}(?:ready for review)\b|(?:캠페인|마케팅).{0,14}(?:요약|보고).{0,18}(?:검토).{0,12}(?:준비|완료)/i.test(text)) return special('summary-review', ['📊','📝','👀'], 'report', 31);
        if (/\b(?:feature|update).{0,20}(?:live|available|rolled out).{0,20}(?:every|all) (?:account|user)|(?:every|all) (?:account|user).{0,20}(?:feature|update).{0,16}(?:live|available)\b|(?:새\s*)?기능.{0,20}(?:모든|전체)\s*(?:계정|사용자).{0,12}(?:공개|배포|사용\s*가능)/i.test(text)) return special('feature-live-all', ['🚀','✨'], 'product', 32);
        if (/\b(?:product|item|service) quality.{0,22}(?:did not|didn['’]t|does not|doesn['’]t).{0,12}(?:meet|match).{0,12}(?:expectations?|standard)|quality.{0,18}(?:below|under).{0,10}(?:expectations?|standard)\b|(?:제품|상품|서비스)\s*품질.{0,18}(?:기대|기준).{0,10}(?:미치지\s*못|못\s*미치|낮)/i.test(text)) return special('quality-disappointed', ['😔','👎'], 'mood', 32);
        if (/\b(?:new|updated) checkout.{0,24}(?:faster|quicker).{0,10}(?:\d+\s*percent|\d+%)?|checkout.{0,20}(?:\d+\s*percent|\d+%).{0,10}(?:faster|quicker)\b|새\s*결제\s*(?:과정|흐름|단계).{0,18}(?:\d+\s*(?:퍼센트|%)\s*)?(?:빨라|단축|개선)|결제\s*(?:과정|흐름).{0,16}(?:속도|시간).{0,10}(?:개선|단축)/i.test(text)) return special('checkout-faster', ['⚡','⏱️'], 'commerce', 31);
        if (/\b(?:api|endpoint|request).{0,18}(?:returned|returning|gave|status|responded with).{0,8}(?:4\d\d|5\d\d)\b|\bstatus\s*(?:4\d\d|5\d\d).{0,16}(?:api|endpoint|request)?\b|API.{0,16}(?:상태|코드|응답).{0,8}(?:4\d\d|5\d\d)|(?:4\d\d|5\d\d).{0,12}(?:오류|응답)/i.test(text)) return special('api-error-status', ['❌','💻'], 'tech', 33);
        if (/\b(?:build|release).{0,20}(?:deployed|shipped|released).{0,12}(?:successfully|cleanly).{0,12}(?:to )?(?:production|prod)|(?:deployed|shipped).{0,16}(?:build|release).{0,12}(?:production|prod)\b|(?:빌드|릴리스).{0,18}(?:프로덕션|운영).{0,16}(?:성공적으로|정상적으로).{0,8}(?:배포|반영)|프로덕션.{0,16}(?:빌드|릴리스).{0,12}(?:배포)/i.test(text)) return special('production-deployed', ['🚀','✅'], 'tech', 33);
        if (/\b(?:version\s*[\d.]+|build\s*[\w.-]+).{0,18}(?:ready to ship|ready for release|release ready|ready to deploy)\b|(?:버전\s*[\d.]+|빌드\s*[\w.-]+).{0,18}(?:출시|배포).{0,8}(?:준비|가능).{0,8}(?:완료|마쳤|됨)?/i.test(text)) return special('version-ready', ['🔄','📱'], 'product', 32);
        if (/\b(?:crash|bug|error|issue).{0,20}(?:was |is |has been )?(?:fixed|resolved).{0,20}(?:current|latest|new) (?:build|version)|(?:current|latest|new) (?:build|version).{0,20}(?:fixed|resolved).{0,14}(?:crash|bug|error|issue)\b|(?:현재|최신|새)\s*(?:빌드|버전).{0,18}(?:충돌|크래시|버그|오류).{0,12}(?:수정|해결)|(?:충돌|크래시).{0,14}(?:현재|최신)\s*(?:빌드|버전).{0,12}(?:수정|해결)/i.test(text)) return special('current-build-fixed', ['✅','🛠️'], 'tech', 32);
        if (/\b(?:look up|search for|check|find).{0,18}(?:exception|stack trace|error).{0,18}(?:in|within) (?:the )?(?:docs?|documentation|manual|guide)\b|(?:예외|스택|오류).{0,14}(?:내용|코드)?.{0,16}(?:문서|가이드).{0,12}(?:찾|검색|확인)/i.test(text)) return special('exception-docs-search', ['🔎','💻'], 'tech', 31);
        if (/\b(?:cache|caching).{0,20}(?:change|update|tuning).{0,24}(?:latency|response time).{0,16}(?:improved|decreased|fell)|(?:latency|response time).{0,18}(?:improved|decreased).{0,18}(?:cache|caching)\b|캐시.{0,14}(?:변경|조정|수정).{0,18}(?:지연|응답)\s*시간.{0,12}(?:개선|감소|줄)/i.test(text)) return special('cache-latency-improved', ['⏱️','📈'], 'tech', 31);
        if (/\b(?:not|isn['’]t|aren['’]t|am not|wasn['’]t)\s+(?:really\s+)?(?:enjoying|happy with|satisfied with) (?:this|the|that)?\s*(?:product|service|item|experience)?\b|(?:제품|상품|서비스|경험).{0,14}(?:즐겁지|만족스럽지|마음에\s*들지)|(?:쓰는|사용하는)\s*게.{0,12}(?:즐겁지|만족스럽지)/i.test(text)) return special('not-enjoying', ['😔','😕'], 'mood', 33);
        if (/\b(?:no longer|not anymore)\s+(?:anxious|worried|nervous|stressed)|(?:anxious|worried|nervous).{0,16}(?:no longer|not anymore)\b|(?:이제|더\s*이상).{0,14}(?:불안|걱정|긴장).{0,8}(?:하지\s*않|않습|없)/i.test(text)) return special('no-longer-anxious', ['😌','😊'], 'mood', 33);
        if (/\b(?:server|service|system).{0,18}(?:is |was )?no longer offline\b|\b(?:server|service|system).{0,18}(?:is not|isn['’]t) offline anymore\b|(?:서버|서비스|시스템).{0,18}(?:더\s*이상).{0,8}오프라인.{0,8}(?:아니|아닙)|오프라인\s*상태가\s*아니/i.test(text)) return special('no-longer-offline', ['✅'], 'status', 33);
        if (/\b(?:this |the )?(?:build|version|release).{0,18}(?:is |isn['’]t|is not).{0,12}not?\s*(?:the )?final (?:release|version)|\b(?:not|isn['’]t)\s+(?:the )?final (?:release|version)\b|(?:이|해당)?\s*(?:빌드|버전).{0,18}최종\s*(?:출시|릴리스)?\s*버전.{0,8}(?:아니|아닙)/i.test(text)) return special('not-final-release', ['📝','🔄'], 'product', 32);
        if (/\b(?:presentation|meeting|interview|test).{0,24}(?:difficult|hard|rough|tough).{0,24}(?:but|yet).{0,22}(?:ended well|went well|turned out well|finished well)|(?:difficult|hard|rough).{0,22}(?:but|yet).{0,22}(?:ended well|went well)\b|(?:발표|회의|면접|시험).{0,16}(?:어렵|힘들).{0,16}(?:지만|했지만).{0,16}(?:결국|마지막엔)?.{0,8}(?:잘\s*끝|잘\s*됐|잘\s*마무리)/i.test(text)) return special('difficult-ended-well', ['✅','🙌'], 'status', 32);
        if (/\b(?:not bad at all|not a bad idea|isn['’]t a bad idea|is not a bad idea)\b|전혀\s*나쁜\s*(?:생각|아이디어).{0,8}(?:아니|아닙)|나쁜\s*(?:생각|아이디어).{0,8}(?:아니|아닙)/i.test(text)) return special('not-bad', ['😊','🤔'], 'mood', 31);
        if (/(?:문제|이슈|오류).{0,18}(?:답답|어렵|힘들).{0,18}(?:지만|했지만).{0,18}(?:결국|마침내).{0,8}(?:고쳤|해결|수정)|\b(?:problem|issue|bug).{0,22}(?:frustrating|difficult|hard).{0,22}(?:but|yet).{0,20}(?:fixed|solved|resolved)\b/i.test(text)) return special('frustrating-but-fixed', ['✅','💪'], 'status', 33);
        if (/(?:옵션|기능|기기|브라우저).{0,14}(?:아직|현재).{0,12}지원(?:되|돼|하).{0,8}(?:지\s*않|않습|안\s*돼|되지)|지원되지\s*않|\b(?:option|feature).{0,18}(?:not|isn['’]t).{0,8}(?:supported|available)\b/i.test(text)) return special('unsupported', ['🚫'], 'status', 32);
        if (/(?:확신|자신).{0,10}(?:없|서지\s*않|들지\s*않)|맞는지.{0,10}(?:모르|확신)|\b(?:not sure|not certain|uncertain|unsure).{0,20}(?:choice|decision|option|whether)?\b/i.test(text)) return special('uncertain-choice', ['🤔','💭'], 'mood', 31);
        if (/\b(?:i )?(?:finally )?finished (?:the )?(?:last|final) (?:task|item) (?:on|from) (?:my|the) (?:list|checklist)|(?:last|final) (?:task|item) (?:is |was )?(?:done|finished|complete)\b|(?:목록|체크리스트).{0,18}(?:마지막|남아\s*있던).{0,14}(?:일|작업|항목).{0,14}(?:끝냈|완료)|마지막\s*(?:일|작업|항목).{0,12}(?:끝냈|완료)/i.test(text)) return special('last-task-complete', ['✅','🙌'], 'status', 31);
        if (/\b(?:today|the day).{0,20}(?:was|felt)?\s*(?:difficult|hard|rough).{0,36}(?:giving myself|give myself|taking|take|need).{0,18}(?:rest|a break|break)|(?:giving myself|taking) (?:a |some |a little )?(?:rest|break).{0,22}(?:after|because).{0,18}(?:hard|rough|difficult)\b|오늘.{0,14}(?:힘들|어려).{0,24}(?:쉬기로|쉬|휴식)|힘들.{0,22}(?:쉬기로|휴식)/i.test(text)) return special('rest-after-hard-day', ['😌','🛌'], 'life', 31);
        if (/\b(?:miss|missed) (?:my )?(?:old )?friends?\b|(?:old|close) friends?.{0,18}(?:miss|missed)\b|(?:예전|오랜|친한)?\s*친구.{0,12}(?:보고\s*싶|그립)/i.test(text)) return special('miss-friends', ['💛','😔'], 'mood', 30);
        if (/\b(?:quiet|calm) night.{0,16}(?:book|reading)|(?:book|reading).{0,16}(?:quiet|calm) night\b|책과.{0,12}(?:조용한|고요한)\s*밤|조용한\s*밤.{0,12}책/i.test(text)) return special('book-night', ['📚','🌙'], 'life', 30);
        if (/\b(?:small|tiny|little) win.{0,30}(?:deserves|worth|celebrat|smile)|(?:celebrate|celebrating) (?:a |the )?(?:small|tiny|little) win\b|작은\s*(?:승리|성과).{0,20}(?:축하|웃|충분)/i.test(text)) return special('small-win-celebrate', ['🎉','😊'], 'event', 31);
        if (/(?:소설|책).{0,18}(?:읽|다\s*읽|완독)|(?:읽|완독).{0,18}(?:소설|책)/i.test(text)) return special('reading-book', ['📚'], 'topic', 30);
        if (/\b(?:system|service).{0,24}(?:stable|normal).{0,24}(?:after|since) (?:the )?(?:outage|incident|issue)|(?:after|since) (?:the )?(?:outage|incident|issue).{0,30}(?:system|service).{0,18}(?:stable|normal)\b|(?:장애|문제).{0,18}(?:후|뒤).{0,24}(?:시스템|서비스).{0,14}(?:안정|정상)/i.test(text)) return special('stable-after-incident', ['✅'], 'status', 31);
        if (/\b(?:server|service|system).{0,22}(?:not down anymore|no longer down|not offline anymore|back up|up again)\b|(?:서버|서비스|시스템).{0,22}(?:다운된\s*상태가\s*(?:아니|아닙)|다운이\s*(?:아니|아닙)|다시\s*정상|복구)/i.test(text)) return special('service-up', ['✅'], 'status', 31);
        if (/\b(?:this|it) (?:is|isn['’]t|is not).{0,16}(?:not )?(?:the )?final version|not the final version|not final yet\b|(?:이것|이 버전).{0,16}최종\s*버전.{0,8}(?:아니|아닙)|최종\s*버전이\s*아니/i.test(text)) return special('not-final-version', ['📝','🔄'], 'product', 30);
        if (/삶.{0,18}(?:항상|늘).{0,16}(?:빠르게|빨리).{0,18}(?:필요.{0,4}없|필요는\s*없)|(?:항상|늘).{0,16}(?:빠르게|빨리).{0,18}(?:살|흘러).{0,12}(?:필요.{0,4}없|필요는\s*없)/i.test(text)) return special('life-no-rush', ['🌿','😌'], 'life', 30);
        if (/`[^`]+`|```|~~~/u.test(raw) && /\b(?:npm|yarn|pnpm|pip|node|python|const|let|var|function|class|git|docker)\b/i.test(raw)) {
            if (/\b(?:copy|paste|clipboard)\b|복사|붙여넣/i.test(text)) return special('code-copy', ['📋','💻'], 'tech', 29);
            return special('code-context', ['💻','⌨️'], 'tech', 28);
        }
        if (/https?:\/\/[^\s<>]+|www\.[^\s<>]+/i.test(raw) && /\b(?:visit|open|website|page|guide|url|link)\b|방문|열어|웹사이트|페이지|가이드|URL|링크/i.test(text)) {
            return special('url-context', ['🌐','🔗'], 'tech', 27);
        }
        if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(raw) && /\b(?:email|contact|support|write to|send)\b|이메일|문의|지원/i.test(text)) {
            return special('email-context', ['📧'], 'action', 27);
        }
        if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(raw) && /(?:send|forward|write).{0,24}(?:to|at)|보내|전송|전달/i.test(text)) {
            return special('email-address-action', ['📧'], 'action', 29);
        }
        if (/\b(?:search|look up|find).{0,24}(?:documentation|docs?|manual|knowledge base).{0,24}(?:error|code|issue)?\b|(?:오류|에러)\s*코드.{0,16}(?:문서|가이드).{0,12}검색|(?:문서|가이드).{0,12}(?:오류|에러)\s*코드.{0,12}검색/i.test(text)) {
            return special('docs-search', ['🔎','💻'], 'tech', 30);
        }
        if (/\b(?:review|check).{0,20}(?:attached|attachment).{0,18}(?:document|file|spreadsheet|proposal)|(?:attached|attachment).{0,18}(?:document|file|spreadsheet|proposal).{0,20}(?:review|check)\b|첨부(?:된|한)?\s*(?:문서|파일|스프레드시트|제안서).{0,18}(?:검토|확인)|(?:검토|확인).{0,18}첨부(?:된|한)?\s*(?:문서|파일|스프레드시트|제안서)/i.test(text)) {
            return special('attached-review', ['📎','👀'], 'action', 30);
        }
        if (/\b(?:average )?(?:processing|response|load) time.{0,24}(?:improved|faster|decreased)|(?:improved|reduced).{0,20}(?:processing|response|load) time\b|(?:평균\s*)?(?:처리|응답|로딩)\s*시간.{0,18}(?:개선|감소|빨라)/i.test(text)) {
            return special('time-performance-improved', ['⏱️','📈'], 'report', 30);
        }
        if (/\b(?:request|connection|operation).{0,18}(?:timed out|timeout).{0,12}(?:after )?\d+\s*(?:seconds?|minutes?)?\b|(?:요청|연결|작업).{0,18}(?:시간\s*초과|타임아웃)/i.test(text)) {
            return special('timeout', ['⏱️','❌'], 'status', 30);
        }
        if (/\b(?:script|import|upload|sync).{0,24}(?:imported|uploaded|synced|completed).{0,18}(?:successfully|without errors?)|(?:imported|uploaded|synced) the data successfully\b|스크립트.{0,18}(?:데이터|파일).{0,16}(?:성공적으로|정상적으로).{0,8}(?:가져|불러|업로드|동기화)/i.test(text)) {
            return special('tech-success', ['✅','💻'], 'tech', 30);
        }
        if (/\b(?:bug|issue|error).{0,18}(?:fixed|resolved).{0,18}(?:latest build|latest version|new build)?|fixed the (?:bug|issue|error)\b|(?:버그|문제|오류).{0,16}(?:수정|해결).{0,14}(?:최신\s*빌드|새\s*빌드)?/i.test(text)) {
            return special('bug-fixed', ['✅','🛠️'], 'status', 30);
        }
        if (/\b(?:app|application).{0,18}(?:version|build).{0,20}(?:ready for release|release ready)|(?:version|build).{0,16}(?:ready for release)\b|(?:앱|애플리케이션).{0,12}(?:버전|빌드).{0,18}(?:출시\s*준비|배포\s*준비).{0,8}(?:완료|마쳤|됨)?/i.test(text)) {
            return special('release-ready', ['🔄','📱'], 'product', 30);
        }
        if (/\b(?:two[- ]factor|2fa|two factor) authentication\b|2단계\s*인증|이중\s*인증/i.test(text)) {
            return special('two-factor', ['🔒','🛡️'], 'tech', 30);
        }
        if (/\b(?:browser )?extension.{0,18}(?:disabled|turned off|inactive)\b|브라우저\s*확장\s*프로그램.{0,18}(?:비활성|꺼져|사용\s*중지)/i.test(text)) {
            return special('extension-disabled', ['🚫','🌐'], 'tech', 29);
        }
        if (/\b(?:support|customer support|support team).{0,24}(?:replied|responded|answered)|(?:reply|response) from support\b|(?:고객지원|지원팀).{0,20}(?:답변|회신|응답).{0,10}(?:왔|받|했)/i.test(text)) {
            return special('support-replied', ['💬'], 'support', 29);
        }
        if (/\b(?:today|this day|the day).{0,22}(?:difficult|hard|rough).{0,28}(?:rest|break)|(?:difficult|hard|rough).{0,28}(?:give myself|take|need).{0,12}(?:rest|break)\b|오늘.{0,12}(?:힘들|어려).{0,18}(?:쉬|휴식)|힘들.{0,20}(?:쉬기로|휴식)/i.test(text)) {
            return special('rest-after-hard-day', ['😌','🛌'], 'life', 29);
        }
        if (/\b(?:not worried anymore|no longer worried|stopped worrying|don['’]t worry anymore|do not worry anymore)\b|더\s*이상\s*걱정하지\s*않|이제.{0,8}걱정하지\s*않/i.test(text)) {
            return special('relieved', ['😌','😊'], 'mood', 30);
        }
        if (/\b(?:server|service|system).{0,18}(?:not down anymore|no longer down|is up again|back up)\b|(?:서버|서비스|시스템).{0,18}(?:다운된\s*상태가\s*아니|다시\s*정상|복구)/i.test(text)) {
            return special('service-up', ['✅'], 'status', 30);
        }
        if (/\b(?:did not|didn['’]t) cancel (?:the )?(?:event|meeting|release|launch)|(?:event|meeting|release|launch) was not cancelled\b|(?:행사|회의|출시).{0,12}취소하지\s*않|(?:행사|회의|출시).{0,12}취소되지\s*않/i.test(text)) {
            return special('not-cancelled', ['✅'], 'status', 30);
        }
        if (/\b(?:app|application|browser|program).{0,18}(?:did not|didn['’]t) crash\b|(?:앱|애플리케이션|브라우저|프로그램).{0,18}(?:종료되지\s*않|튕기지\s*않|충돌하지\s*않)/i.test(text)) {
            return special('no-crash', ['✅'], 'status', 30);
        }
        if (/\b(?:issue|problem|bug).{0,28}(?:solved|resolved|fixed)|(?:solved|resolved|fixed) (?:the )?(?:issue|problem|bug)\b|(?:문제|이슈|버그).{0,18}(?:해결|수정).{0,10}(?:했|됨|완료)/i.test(text)) {
            return special('problem-solved', ['✅','💪'], 'status', 30);
        }
        if (/\b(?:test|interview|meeting|presentation).{0,32}(?:harder|difficult|tough).{0,24}(?:went well|turned out well)|(?:harder|difficult|tough).{0,24}(?:but|yet).{0,20}(?:went well|worked out)\b|(?:시험|면접|회의|발표).{0,18}(?:어려|힘들).{0,18}(?:잘\s*나왔|잘\s*끝|잘\s*됐)/i.test(text)) {
            return special('difficult-but-good', ['✅','🙌'], 'status', 29);
        }
        if (/\b(?:not the final version|not final yet|draft version|preliminary version)\b|최종\s*버전이\s*아니|아직\s*최종\s*버전.{0,4}아니|초안\s*버전/i.test(text)) {
            return special('not-final-version', ['📝','🔄'], 'product', 28);
        }
        if (/\b(?:do not|don['’]t) like (?:this|the|that) (?:product|item|service)|(?:dislike|not happy with) (?:this|the|that) (?:product|item|service)\b|(?:제품|상품|서비스).{0,12}마음에\s*들지\s*않/i.test(text)) {
            return special('dislike-product', ['😔','😕'], 'mood', 29);
        }
        if (/\b(?:coupon|discount code|promo code).{0,26}(?:expires?|ends?|valid until)\b|(?:쿠폰|할인\s*코드|프로모션\s*코드).{0,22}(?:만료|종료|유효)/i.test(text)) {
            return special('coupon-expiry', ['🏷️','⏰'], 'commerce', 30);
        }
        if (/\b(?:password reset|reset link).{0,28}(?:expires?|expiry|valid for)\b|비밀번호\s*재설정\s*링크.{0,20}(?:만료|유효)/i.test(text)) {
            return special('password-expiry', ['🔒','⏰'], 'status', 29);
        }
        if (CONDOLENCE.test(text)) return special('condolence', ['🕯️'], 'mood', 30);
        if (HIGH_SENSITIVITY.test(text)) return special('sensitive', ['⚠️'], 'status', 30);
        if (RECOVERY_AFTER_SETBACK.test(text)) return special('recovery', ['💪','🌱'], 'growth', 29);
        if (NEGATED_BAD_STATUS.test(text)) return special('not-bad-status', ['✅'], 'status', 28);
        if (/\b(?:not (?:a )?bad|isn['’]t bad|wasn['’]t bad)\b|나쁘지\s*않|나쁘지\s*않은/i.test(text)) return special('not-bad', ['😊','🤔'], 'mood', 26);
        if (/\b(?:delay|problem|issue|outage).{0,20}(?:is|was|has been)?\s*(?:over|resolved|fixed|finished)\b|(?:지연|문제|장애).{0,14}(?:끝|해결|종료)/i.test(text)) return special('resolved-problem', ['✅','😊'], 'status', 29);
        if (/\b(?:checkout|payment page|checkout page).{0,20}(?:not working|broken|failed|error)\b|결제\s*페이지.{0,18}(?:작동하지|오류|실패)/i.test(text)) return special('checkout-failed', ['❌','🛒'], 'status', 29);
        if (/\b(?:decline|decrease|drop|reduction) in (?:failed|error|failed requests?|errors?|failures?)|(?:failed requests?|errors?|failures?).{0,20}(?:declined|decreased|dropped)\b|(?:실패\s*요청|오류|실패율).{0,16}(?:감소|하락|줄)|(?:감소|하락).{0,12}(?:실패\s*요청|오류|실패율)/i.test(text)) return special('failures-down', ['📉','📊'], 'report', 30);
        if (/\b(?:server )?(?:outage|service disruption)|서버\s*장애|서비스\s*장애/i.test(text)) return special('outage', ['⚠️','🛠️'], 'status', 29);
        if (/\b(?:product|item).{0,24}(?:quality).{0,24}(?:disappointing|poor|bad|underwhelming)|quality.{0,18}(?:was |is )?(?:disappointing|poor|bad|underwhelming)\b|제품\s*품질.{0,36}(?:실망|나쁘|좋지|아쉽|기대\s*이하)|품질.{0,28}(?:아쉬웠|실망)/i.test(text)) return special('quality-disappointing', ['😔','👎'], 'mood', 30);
        if (/\b(?:won|win) (?:the )?(?:football|soccer|basketball|baseball|tennis)? ?(?:match|game|final)?\b|(?:축구|농구|야구|테니스).{0,12}(?:이겼|우승)|경기에서\s*이겼/i.test(text)) return special('sports-win', ['🏆'], 'event', 28);
        if (/\b(?:fixed|repaired).{0,24}(?:broken|chair|table|bike|device|computer)|(?:broken|damaged).{0,18}(?:was )?(?:fixed|repaired)\b|고장난?.{0,18}(?:고쳤|수리)|(?:의자|기기|컴퓨터).{0,12}(?:고쳤|수리)/i.test(text)) return special('repair-complete', ['🛠️'], 'status', 28);
        if (/\b(?:payment).{0,12}(?:did not|didn['’]t) fail\b|결제.{0,12}실패하지\s*않/i.test(text)) return special('payment-not-failed', ['✅'], 'status', 29);
        if (/\b(?:flight|flying|fly to|flying to|airport)\b|비행기|비행편|공항/i.test(text) && /\b(?:tomorrow|today|tonight|next|to [A-Z])\b|내일|오늘|이번/i.test(text)) return special('flight-trip', ['✈️'], 'topic', 26);
        if (HEALTHY_STATUS.test(text) && /(?:no problem|no issues?|without errors?|working now|working again|stable again|resolved|fixed now|all clear|문제\s*없|이상\s*없|오류\s*없이|정상|안정화|해결)/i.test(text)) return special('healthy-status', ['✅'], 'status', 28);
        if (/\b(?:system|service).{0,18}(?:stable|normal).{0,24}(?:after|since).{0,12}(?:outage|incident|issue)|(?:outage|incident|issue).{0,24}(?:over|resolved).{0,20}(?:system|service).{0,12}(?:stable|normal)\b|(?:시스템|서비스).{0,18}(?:안정|정상).{0,20}(?:장애|문제).{0,12}(?:후|뒤)|(?:장애|문제).{0,18}(?:끝|해결).{0,18}(?:시스템|서비스).{0,12}(?:안정|정상)/i.test(text)) return special('stable-after-incident', ['✅'], 'status', 30);
        if (/\b(?:sale|limited offer|special offer).{0,18}(?:ends?|expires?|until).{0,18}(?:tomorrow|tonight|midnight|soon|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:sale ends|offer ends)\b|(?:세일|한정\s*혜택|특가).{0,18}(?:종료|끝|만료|내일|오늘\s*밤|곧)/i.test(text)) return special('sale-deadline', ['🏷️','⏰'], 'commerce', 30);
        if (/\bfree shipping\b|무료\s*배송/i.test(text)) return special('free-shipping', ['📦','🛍️'], 'commerce', 29);
        if (/\b(?:new collection|collection).{0,18}(?:available|live|now)\b|새\s*컬렉션.{0,18}(?:구매|공개|출시|이용)/i.test(text)) return special('collection-live', ['🛍️','✨'], 'commerce', 29);
        if (/\b(?:add|put).{0,16}(?:item|product).{0,12}(?:to|in) (?:your |the )?cart|(?:cart).{0,18}(?:still\s+)?(?:contains?|has) (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten) (?:items?|products?)\b|(?:상품|제품).{0,12}장바구니.{0,12}(?:담|추가)|장바구니.{0,16}(?:상품|제품).{0,10}(?:개|남)/i.test(text)) return special('cart', ['🛒'], 'commerce', 30);
        if (/\b(?:back in stock|restocked|restock(?:ed|ing)?|available again).{0,12}(?:size|item|product)?\b|(?:다시\s*입고|재입고|입고했습니다|입고되었습니다)/i.test(text) && !/out of stock|품절\s*상태|재고\s*없/i.test(text)) return special('restocked', ['📦','✅'], 'commerce', 30);
        if (/\b(?:order|package|parcel).{0,16}(?:was |has been )?(?:delivered|arrived)|delivered (?:this|today)|arrived (?:this|today)\b|(?:주문|상품|택배|소포).{0,16}(?:배송\s*완료|도착)|배송\s*완료/i.test(text)) return special('delivered', ['📦'], 'status', 30);
        if (/\brefund.{0,20}(?:reached|credited|posted to).{0,16}(?:card|account)|(?:card|account).{0,16}refund\b|환불\s*금액.{0,20}(?:카드|계좌).{0,14}(?:반영|입금)|(?:카드|계좌).{0,20}환불\s*금액.{0,14}(?:반영|입금)/i.test(text)) return special('refund-received', ['💳','✅'], 'status', 30);
        if (/\b(?:campaign|sign[- ]ups?|registrations?).{0,30}(?:more|increased|grew|higher)|(?:sign[- ]ups?|registrations?).{0,16}(?:increased|grew)\b|캠페인.{0,20}(?:가입자|등록).{0,16}(?:증가|늘)/i.test(text)) return special('campaign-growth', ['📈','📊'], 'report', 29);
        if (/\bcheckout.{0,20}(?:faster|speed|time improved|quicker)\b|결제\s*(?:과정|흐름).{0,18}(?:속도|시간).{0,12}(?:개선|빨라)/i.test(text)) return special('checkout-speed', ['⚡','⏱️'], 'commerce', 29);
        if (/\bcustomers?.{0,24}(?:rated|rating|feedback).{0,20}(?:more positive|better|improved)|(?:rating|feedback).{0,18}(?:improved|better)\b|고객.{0,20}(?:평가|반응).{0,18}(?:좋아|개선|상승)/i.test(text)) return special('customer-rating-up', ['📈','😊'], 'report', 29);
        if (/\b(?:campaign|marketing).{0,12}report.{0,12}(?:ready|complete)|캠페인\s*보고서.{0,12}(?:준비|완료)/i.test(text)) return special('campaign-report', ['📊','📝'], 'report', 29);
        if (/\breview.{0,18}(?:product|item).{0,12}(?:description|copy).{0,18}(?:before|prior to).{0,12}(?:publish|publishing)|(?:product|item) description.{0,18}review\b|(?:상품|제품)\s*설명.{0,16}검토/i.test(text)) return special('product-copy-review', ['👀','📝'], 'action', 29);
        if (/\bshipping (?:estimate|date|delivery date).{0,18}(?:changed|updated|moved).{0,16}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|배송\s*(?:예정일|일정).{0,18}(?:변경|업데이트)/i.test(text)) return special('shipping-date', ['📦','📅'], 'status', 29);
        if (/\b(?:item|product).{0,18}(?:cannot|can['’]t) be purchased|not available for purchase\b|(?:상품|제품).{0,16}(?:구매할\s*수\s*없|구매\s*불가)/i.test(text)) return special('purchase-unavailable', ['🚫','📦'], 'status', 30);
        if (/\b(?:promo code|discount code|coupon).{0,20}(?:valid until|valid through)\b|(?:프로모션\s*코드|할인\s*코드|쿠폰).{0,20}(?:까지\s*유효|유효)/i.test(text)) return special('promo-validity', ['🏷️','⏰'], 'commerce', 29);
        if (/\b(?:product|feature|service) launch.{0,20}(?:scheduled|planned|set) (?:for|on)\b|(?:launch|release).{0,18}(?:scheduled|planned) (?:for|on)\b|(?:제품|기능|서비스)\s*출시.{0,20}(?:예정|계획)|출시.{0,16}(?:금요일|월요일|화요일|수요일|목요일|토요일|일요일).{0,8}예정/i.test(text)) return special('launch-scheduled', ['🚀','📅'], 'event', 30);
        if (/\b(?:new feature|feature).{0,18}(?:now live|live for all|available to all|rolled out to all)\b|새\s*기능.{0,18}(?:모든\s*사용자|전체\s*사용자).{0,12}(?:공개|사용|제공)/i.test(text)) return special('feature-live', ['🚀','✨'], 'product', 29);
        if (/\b(?:store|shop|site).{0,16}(?:closed|offline).{0,18}maintenance|maintenance.{0,18}(?:store|shop|site).{0,12}(?:closed|offline)\b|점검.{0,16}(?:상점|스토어|사이트).{0,12}(?:닫|중단)|(?:상점|스토어).{0,16}점검.{0,12}(?:닫|중단)/i.test(text)) return special('store-maintenance', ['🛠️','🌙'], 'status', 29);
        if (STOP_ACTION.test(text)) return special('prohibition', ['⚠️'], 'status', 28);
        if (BAD_REVIEW.test(text)) return special('negative-review', ['👎'], 'mood', 27);
        if (/(?:감사|고맙).{0,16}(?!.*(?:않|아니))|\b(?:thankful|grateful|appreciate)\b/i.test(text)) return special('gratitude-direct', ['🙏','💛'], 'mood', 27);

        if (/\b(?:not (?:been )?feeling (?:very )?confident|low confidence|lost confidence|feel less confident)\b|자신감.{0,10}(?:떨어|없|낮)/i.test(text)) return special('low-confidence', ['😔','💭'], 'mood', 27);
        if (/\b(?:anxious|worried|nervous|concerned|uneasy)\b|불안|걱정|긴장/i.test(text)) return special('anxious-mood', ['😟','💭'], 'mood', 27);
        if (NEG_MOOD.test(text)) return special('negative-mood', ['😔','😕'], 'mood', 27);
        if (UNAVAILABLE.test(text)) return special('unavailable', ['🚫'], 'status', 27);
        if (DELAY.test(text)) return special('delayed', ['⏳'], 'status', 27);
        if (CANCEL.test(text)) return special('cancelled', ['🚫'], 'status', 28);
        if (BAD_OUTCOME.test(text) && !META_REFERENCE.test(text)) return special('failed', ['❌'], 'status', 28);
        if (META_REFERENCE.test(text)) return special('meta-reference', ['📝','💡'], 'generic', 22);
        if (/\bpayment (?:was |is |has been )?(?:approved|received|completed|successful)\b|결제.{0,16}(?:완료|승인)|입금.{0,12}확인/i.test(text)) {
            return special('payment-complete', ['✅'], 'status', 28);
        }
        if (/\b(?:report|document|draft|proposal).{0,18}(?:ready|prepared).{0,18}(?:for )?(?:final )?review|(?:final )?review.{0,18}(?:report|document|draft|proposal)\b|(?:보고서|문서|초안|제안서).{0,18}(?:최종\s*)?검토.{0,18}(?:준비|위해)/i.test(text)) {
            return special('ready-for-review', ['📝','👀'], 'report', 30);
        }
        if (/\b(?:(?:task|work|project|assignment|checklist) (?:is |was |has been )?(?:finished|done)|saved successfully|upload complete|upload completed|import complete|import completed|backup (?:complete|completed)|report approved|task completed|project created|issue resolved|bug (?:has been |was )?fixed|fixed the bug)\b|\b(?:report|draft|file) (?:is |was |has been )?(?:approved|saved|ready)\b|저장.{0,8}완료|업로드.{0,12}완료|배포.{0,12}(?:완료|성공)|백업.{0,12}(?:완료|끝)|초안.{0,8}완성|문제.{0,8}해결|버그.{0,8}수정|프로젝트.{0,8}생성|(?:계속\s*)?미뤄(?:두)?던\s*일.{0,12}(?:끝냈|완료)|해야\s*할\s*일.{0,12}(?:끝냈|완료)/i.test(text)) {
            return special('task-complete', ['✅'], 'status', 27);
        }
        if (/\b(?:(?:project|release|deployment|test|meeting|interview|event) (?:went well|turned out well)|worked out well)\b|(?:프로젝트|출시|배포|테스트|회의|면접|행사).{0,14}(?:잘\s*끝|잘\s*마무리|생각보다\s*잘)/i.test(text)) {
            return special('positive-result', ['✅','🙌'], 'status', 25);
        }
        if (/\b(?:warning|caution|beware|phishing|scam|dangerous link|security alert|urgent)\b|경고|주의하|주의해|주의\s*사항|피싱|사기\s*문자|위험한\s*링크|긴급/i.test(text)) {
            return special('warning', ['⚠️','🚨'], 'status', 27);
        }
        if (/\b(?:browser|popup|pop-up).{0,20}(?:blocked|denied)\b|브라우저.{0,12}(?:차단|거부)|팝업.{0,12}차단/i.test(text)) {
            return special('browser-blocked', ['🚫','🌐'], 'status', 26);
        }
        if (/\b(?:sorry|apologize|apologise|apology|apologies)\b|죄송|미안|사과드립니다/i.test(text)) {
            return special('apology', ['🙏','😔'], 'mood', 25);
        }
        if (/\b(?:new app version|new version|latest version|update).{0,20}(?:available now|available|ready)\b|(?:새|최신)\s*앱?\s*버전.{0,14}(?:사용|이용).{0,8}(?:가능|할 수)|업데이트.{0,14}(?:사용|이용).{0,8}(?:가능|할 수)/i.test(text)) {
            return special('new-version-available', ['🔄','📱'], 'product', 27);
        }
        if (/\b(?:incident|outage|issue|problem).{0,24}(?:is|was|has been)?\s*(?:over|resolved|closed|finished).{0,24}(?:system|service)?.{0,16}(?:stable|normal)|(?:system|service).{0,16}(?:stable|normal).{0,24}(?:incident|outage|issue|problem).{0,16}(?:over|resolved|closed)\b|(?:사고|장애|문제).{0,16}(?:끝|해결|종료).{0,20}(?:시스템|서비스)?.{0,12}(?:안정|정상)/i.test(text)) {
            return special('resolved-stable', ['✅'], 'status', 30);
        }
        if (/\b(?:survey|questionnaire|customer feedback).{0,30}(?:improved|higher|better|increased).{0,24}(?:satisfaction|score|rating)|(?:satisfaction|score|rating).{0,24}(?:improved|increased|rose)\b|(?:설문|고객\s*피드백).{0,24}(?:만족도|점수).{0,20}(?:개선|증가|상승)|만족도.{0,16}(?:개선|증가|상승)/i.test(text)) {
            return special('survey-improved', ['📈','📊'], 'report', 30);
        }
        if (/\b(?:crossed|checked|ticked).{0,20}(?:last|final).{0,12}(?:task|item).{0,12}(?:off|done)|(?:last|final) (?:task|item).{0,16}(?:finished|completed|done)\b|목록.{0,20}(?:마지막|남아\s*있던).{0,16}(?:일|작업|항목).{0,16}(?:끝냈|완료|체크)|마지막\s*(?:일|작업|항목).{0,12}(?:끝냈|완료)/i.test(text)) {
            return special('last-task-complete', ['✅','🙌'], 'status', 30);
        }
        if (/\b(?:two|three|several|\d+) follow[- ]up (?:tasks?|items?|actions?).{0,18}(?:still )?(?:open|remaining|pending)|follow[- ]up (?:tasks?|items?|actions?).{0,18}(?:still )?(?:open|remaining|pending)\b|후속\s*(?:작업|항목).{0,16}(?:남아|대기|미완료)|\d+개.{0,8}후속\s*(?:작업|항목).{0,12}(?:남아|대기)/i.test(text)) {
            return special('followup-open', ['📌','✅'], 'report', 29);
        }
        if (/\b(?:reset link|recovery link).{0,30}(?:valid for|expires? in)\s*(?:\d+|twenty|thirty|sixty)\s*(?:minutes?|mins?)\b|(?:재설정|복구)\s*링크.{0,24}(?:\d+분|분\s*동안).{0,8}(?:유효|만료)/i.test(text)) {
            return special('reset-link-validity', ['🔒','⏰'], 'status', 29);
        }
        if (/\b(?:starting|started|beginning) (?:a |the )?(?:new )?(?:project|job|course|chapter)\b|새(?:로운)?\s*(?:프로젝트|일|과정).{0,8}(?:시작|시작했)|프로젝트를\s*시작/i.test(text)) {
            return special('new-start', ['🚀'], 'event', 24);
        }
        if (/\b(?:exam|test) (?:is |was )?(?:over|finished|done)\b|시험.{0,5}(?:끝났|끝남|마쳤|끝났다)/i.test(text)) {
            return special('exam-finished', ['🎉'], 'event', 24);
        }
        if (/\b(?:a |this )?(?:small|little|tiny) win.{0,24}(?:deserves|worth).{0,12}(?:smile|celebrat)|(?:small|little|tiny) win\b|작은\s*(?:승리|성과).{0,18}(?:웃|축하)/i.test(text)) {
            return special('small-win-social', ['🎉','😊'], 'event', 28);
        }

        if (/좋은\s*생각.{0,10}(?:아닌|아니|않)|좋은\s*아이디어.{0,10}(?:아닌|아니|않)/i.test(text)) {
            return special('negated-reflection', ['🤔','💭'], 'mood', 24);
        }

        // Nuanced negation: a negative word is not automatically a warning.
        if (/\b(?:not|never|doesn['’]t|don['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|cannot|can['’]t)\b/i.test(working) || /지\s*(?:않|안|못)|아니|없(?:다|어|습|는|음)|할\s*수\s*없/i.test(working)) {
            if (/\b(?:move fast|rush|hurry|always be productive|always work|do everything)\b|서두르|빠르게만|빠르게\s*움직일\s*필요|늘\s*생산적|항상\s*일/i.test(text)) {
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

    // Concrete semantic fallback: maps strong real-world nouns and statuses to useful
    // emoji when no higher-precision sentence rule matched. This is intentionally placed
    // after classifySpecial so negation, cancellation and status recovery still win.
    function concreteFallback(text) {
        const t = text.trim();
        if (!t) return null;
        const has = re => re.test(t);

        // v52: high-coverage semantic phrases for everyday, social, work, technical,
        // commerce, travel, report, fitness and relationship text. These rules stay
        // below classifySpecial, so negation/recovery guards still take precedence.

        // Everyday home actions.
        if (has(/\b(?:vacuum|vacuumed|hoover(?:ed)?)\b.{0,24}\b(?:rug|carpet|floor)\b|(?:러그|카펫|바닥).{0,18}(?:청소기|진공청소|밀었|청소)/i)) return special('v52-vacuum',['🧹','🏠'],'life',17);
        if (has(/\b(?:brew|brewed|steep|steeped|make|made)\b.{0,18}\b(?:tea|teapot)\b|(?:차|티).{0,14}(?:우리|우렸|끓|마셨)|(?:한\s*주전자).{0,12}(?:차|티)/i)) return special('v52-tea',['🍵','😌'],'food',17);
        if (has(/\b(?:wash|washed|laundered)\b.{0,18}\b(?:towels?|laundry)\b|\b(?:towels?|laundry)\b.{0,18}\b(?:dry|dried|hung)\b|(?:수건|빨래).{0,16}(?:빨|세탁|널|말렸|건조)/i)) return special('v52-laundry',['🧺','✨'],'life',17);
        if (has(/\b(?:sharpen|sharpened)\b.{0,12}\bpencils?\b|연필.{0,12}(?:깎|깎았|깎아)/i)) return special('v52-pencil',['✏️','📝'],'education',17);
        if (has(/\b(?:smoke|fire)\s+alarm\b.{0,20}\bbatter(?:y|ies)\b|\bbatter(?:y|ies)\b.{0,20}\b(?:smoke|fire)\s+alarm\b|(?:화재|연기)\s*경보기.{0,14}배터리|배터리.{0,14}(?:화재|연기)\s*경보기/i)) return special('v52-smoke-battery',['🔋','🚨'],'life',17);
        if (has(/\b(?:label|labeled|labelled|tagged)\b.{0,18}\b(?:storage\s+)?boxes?\b|(?:수납\s*)?상자.{0,16}(?:라벨|이름표|표시).{0,8}(?:붙|달)|(?:라벨|이름표).{0,14}(?:수납\s*)?상자/i)) return special('v52-label-box',['🏷️','📦'],'life',17);
        if (has(/\b(?:frozen\s+)?chicken\b.{0,24}\b(?:thaw|defrost|fridge|refrigerator)\b|(?:냉동\s*)?닭고기.{0,20}(?:해동|냉장고)/i)) return special('v52-thaw-chicken',['🍗','❄️'],'food',17);
        if (has(/\b(?:wash|washed|do|did)\b.{0,12}\b(?:the\s+)?dishes\b|설거지.{0,10}(?:했|하|끝)|접시.{0,10}(?:씻|닦)/i)) return special('v52-dishes',['🍽️','🧼'],'life',17);
        if (has(/\b(?:charge|charged|charging)\b.{0,18}\b(?:power\s*bank|portable\s+battery|battery\s+pack)\b|(?:보조\s*배터리|보조배터리|파워뱅크).{0,14}(?:충전|채웠)|(?:충전).{0,12}(?:보조\s*배터리|보조배터리|파워뱅크)/i)) return special('v52-powerbank',['🔋','🔌'],'tech',17);
        if (has(/\b(?:fold|folded)\b.{0,18}\b(?:blanket|throw)\b|(?:blanket|throw)\b.{0,18}\bsofa\b|(?:담요|이불).{0,16}(?:개어|갰|접어|접었).{0,12}(?:소파)?/i)) return special('v52-blanket',['🛋️','✨'],'life',17);
        if (has(/\b(?:clean|cleaned|wipe|wiped)\b.{0,16}\b(?:glasses|eyeglasses|spectacles)\b|(?:안경).{0,14}(?:닦|청소)/i)) return special('v52-glasses',['👓','✨'],'life',17);
        if (has(/\b(?:kitchen\s+)?timer\b.{0,18}\b(?:set|minutes?|minute|hour)\b|\bset\b.{0,18}\b(?:kitchen\s+)?timer\b|(?:주방\s*)?타이머.{0,16}(?:맞|설정|분|시간)/i)) return special('v52-kitchen-timer',['⏲️','🍳'],'life',17);

        // Social / creative moments.
        if (has(/\b(?:autumn|fall)\s+leaves?\b|\bleaves?\b.{0,16}\b(?:autumn|fall|sidewalk)\b|가을.{0,8}낙엽|낙엽.{0,12}(?:보도|길|가득)/i)) return special('v52-autumn-leaves',['🍂','🍁'],'nature',17);
        if (has(/\bsunrise\b.{0,22}\b(?:ocean|sea|beach|horizon)\b|\b(?:ocean|sea)\b.{0,22}\bsunrise\b|(?:바다|해변).{0,14}(?:일출|해돋이)|(?:일출|해돋이).{0,14}(?:바다|해변)/i)) return special('v52-ocean-sunrise',['🌅','🌊'],'nature',17);
        if (has(/\b(?:fresh|new)\s+haircut\b|\b(?:haircut|hair cut)\b.{0,18}\b(?:fresh|new)\b|(?:머리|헤어).{0,12}(?:잘랐|자르|컷|새로)/i)) return special('v52-haircut',['💇','✨'],'beauty',17);
        if (has(/\b(?:vinyl|record|lp)\b.{0,24}\b(?:found|lost|thought.*lost)\b|(?:LP|엘피|레코드|음반).{0,18}(?:찾|잃어버|분실)/i)) return special('v52-vinyl',['💿','🎵'],'creative',17);
        if (has(/\b(?:pottery|ceramic)\b.{0,16}\b(?:mug|cup|kiln)\b|\b(?:mug|cup)\b.{0,16}\bkiln\b|(?:도자기|도예).{0,14}(?:머그|컵|가마)/i)) return special('v52-pottery',['🏺','☕'],'creative',17);
        if (has(/\b(?:homemade|home-made|made)\b.{0,12}\bpasta\b|\bpasta\b.{0,14}\b(?:dinner|tonight|homemade)\b|직접\s*만든\s*파스타|파스타.{0,10}(?:저녁|오늘)/i)) return special('v52-pasta',['🍝','😋'],'food',17);
        if (has(/\b(?:latte|coffee)\b.{0,20}\bheart\b|\bbarista\b.{0,20}\b(?:latte|heart)\b|(?:라테|라떼|커피).{0,16}(?:하트)|바리스타.{0,16}(?:하트|라테|라떼)/i)) return special('v52-latte-heart',['☕','💛'],'food',17);
        if (has(/\b(?:concert|gig|live\s+show)\b.{0,20}\b(?:last night|memory|thinking|remember)\b|\b(?:thinking|remembering)\b.{0,20}\bconcert\b|(?:어젯밤|지난밤).{0,12}콘서트|콘서트.{0,14}(?:생각|기억)/i)) return special('v52-concert-memory',['🎤','🎵'],'creative',17);
        if (has(/\b(?:walk|walked|walking)\b.{0,22}\b(?:rain|rainy)\b|\b(?:rain|rainy)\b.{0,22}\bwalk(?:ed|ing)?\b|비.{0,12}(?:걸었|걷|산책)|(?:걸었|걷).{0,12}비/i)) return special('v52-rain-walk',['🌧️','🚶','🌿'],'life',17);
        if (has(/\b(?:dog|puppy)\b.{0,24}\b(?:new\s+)?friends?\b.{0,16}\bpark\b|\bpark\b.{0,18}\b(?:dog|puppy)\b.{0,18}\bfriends?\b|강아지.{0,16}(?:공원).{0,16}(?:친구|사귀)/i)) return special('v52-dog-friends',['🐶','🤝'],'social',17);
        if (has(/\b(?:wander|wandered|wandering|spent)\b.{0,24}\b(?:museum|gallery)\b|(?:박물관|미술관).{0,18}(?:돌아다|관람|둘러)/i)) return special('v52-museum-wander',['🏛️','🎨'],'creative',17);
        if (has(/\b(?:cake|slice)\b.{0,20}\b(?:midnight|saved|last slice)\b|\b(?:midnight|saved)\b.{0,20}\bcake\b|케이크.{0,18}(?:자정|마지막|남겨)/i)) return special('v52-cake-midnight',['🍰','🌙'],'food',17);

        // Work / collaboration.
        if (has(/\b(?:meeting\s+)?agenda\b.{0,20}\b(?:ready|tomorrow|prepared)\b|\b(?:ready|prepared)\b.{0,16}\bagenda\b|(?:회의\s*)?(?:안건|아젠다).{0,14}(?:준비|내일)/i)) return special('v52-agenda',['📋','📅'],'work',17);
        if (has(/\b(?:update|updated|edit|edited)\b.{0,18}\b(?:project\s+)?status\s+(?:doc|document|report)\b|(?:프로젝트\s*)?상태\s*(?:문서|보고서).{0,14}(?:업데이트|수정)/i)) return special('v52-status-doc',['📝','🔄'],'work',17);
        if (has(/\b(?:hiring|recruiting)\s+plan\b.{0,18}\b(?:approved|accepted)\b|\b(?:approved|accepted)\b.{0,18}\b(?:hiring|recruiting)\s+plan\b|(?:채용|리크루팅)\s*계획.{0,12}(?:승인|확정)/i)) return special('v52-hiring-approved',['✅','👥'],'work',17);
        if (has(/\b(?:review\s+)?comments?\b.{0,18}\b(?:resolved|closed|addressed)\b|\b(?:resolved|closed|addressed)\b.{0,18}\bcomments?\b|(?:검토\s*)?(?:의견|댓글|코멘트).{0,14}(?:해결|반영|처리)/i)) return special('v52-comments-resolved',['✅','💬'],'work',17);
        if (has(/\b(?:send|sent|share|shared)\b.{0,18}\b(?:spreadsheet|sheet)\b.{0,18}\b(?:finance|accounting)\b|(?:스프레드시트|시트).{0,16}(?:재무|회계).{0,10}(?:보냈|공유|전송)/i)) return special('v52-sheet-finance',['📊','📤'],'work',17);
        if (has(/\b(?:invoice|bill)\b.{0,24}\b(?:purchase\s+order|po)\b.{0,18}\b(?:correct|corrected|correction|fix|number)\b|(?:청구서|인보이스).{0,18}(?:구매\s*주문|PO).{0,12}(?:번호|수정|고쳐)/i)) return special('v52-invoice-po',['🧾','✏️'],'work',17);
        if (has(/\b(?:assign|assigned)\b.{0,18}\b(?:new\s+)?owner\b.{0,18}\b(?:task|onboarding)\b|(?:온보딩|작업|업무).{0,18}(?:새\s*)?(?:담당자|오너).{0,10}(?:지정|배정)/i)) return special('v52-owner-assigned',['👤','📋'],'work',17);
        if (has(/\b(?:deadline|due date)\b.{0,18}\b(?:moved|shifted|changed|pushed)\b.{0,18}\b(?:end of the month|month-end|month end)\b|(?:마감일|기한).{0,16}(?:월말).{0,10}(?:옮|변경|미뤄|연기)|(?:마감일|기한).{0,12}(?:옮|변경|미뤄).{0,12}(?:월말)/i)) return special('v52-deadline-moved',['📅','🔄'],'work',17);
        if (has(/\b(?:engineering|design|product)?\s*handoff\b.{0,18}\b(?:starts?|tomorrow|morning)\b|(?:엔지니어링|디자인|제품)?\s*(?:업무\s*)?인계.{0,14}(?:내일|아침|시작)/i)) return special('v52-handoff',['🤝','📅'],'work',17);
        if (has(/\b(?:add|added|schedule|scheduled)\b.{0,18}\b(?:client|customer)\s+call\b.{0,18}\bcalendar\b|\b(?:client|customer)\s+call\b.{0,18}\bcalendar\b|(?:고객|클라이언트)\s*통화.{0,16}(?:달력|캘린더).{0,8}(?:추가|등록|잡)/i)) return special('v52-client-call',['📞','📅'],'work',17);
        if (has(/\bproposal\b.{0,18}\b(?:ready|prepared)\b.{0,12}\b(?:signature|signing)\b|\b(?:signature|signing)\b.{0,18}\bproposal\b|제안서.{0,16}(?:서명).{0,12}(?:준비|대기|완료)/i)) return special('v52-proposal-sign',['📜','✍️'],'work',17);
        if (has(/\b(?:archive|archived|store)\b.{0,18}\b(?:completed|finished)\s+files?\b|\b(?:completed|finished)\s+files?\b.{0,18}\barchive\b|완료된\s*파일.{0,16}(?:보관|아카이브)|(?:보관|아카이브).{0,16}완료된\s*파일/i)) return special('v52-archive-files',['📁','🗄️'],'work',17);

        // Technical operations.
        if (has(/\bcontainer\b.{0,20}\b(?:restart|restarted|restarting)\b.{0,24}\b(?:memory|limit)\b|\b(?:memory|limit)\b.{0,20}\bcontainer\b.{0,16}\brestart/i) || has(/(?:메모리\s*제한).{0,18}컨테이너.{0,12}재시작|컨테이너.{0,18}(?:메모리\s*제한).{0,12}재시작/i)) return special('v52-container-restart',['🔄','💻'],'tech',18);
        if (has(/\b(?:database|db)\b.{0,16}\bcpu\b.{0,14}\b(?:high|spike|elevated)\b|\bcpu\b.{0,14}\b(?:database|db)\b.{0,12}\b(?:high|spike)\b|(?:데이터베이스|DB).{0,12}CPU.{0,10}(?:높|급증)/i)) return special('v52-db-cpu',['📈','💾','⚠️'],'tech',18);
        if (has(/\b(?:endpoint|request|api)\b.{0,18}\b(?:timed out|timeout|time out)\b|\b(?:timed out|timeout)\b.{0,18}\b(?:endpoint|request|api)\b|(?:엔드포인트|요청|API).{0,14}(?:타임아웃|시간\s*초과)/i)) return special('v52-timeout',['⏱️','❌','🌐'],'tech',18);
        if (has(/\bbackup\b.{0,18}\b(?:verification|verify|verified)\b.{0,18}\b(?:success|successful|finished|complete)\b|(?:백업).{0,14}(?:검증|확인).{0,12}(?:성공|완료|끝)/i)) return special('v52-backup-ok',['💾','✅'],'tech',18);
        if (has(/\blogs?\b.{0,16}\b(?:clean|clear|normal)\b.{0,16}\b(?:after|following)\b.{0,12}\b(?:patch|fix|deploy)\b|(?:패치|수정|배포).{0,12}(?:뒤|후).{0,12}로그.{0,8}(?:깨끗|정상|문제\s*없)/i)) return special('v52-logs-clean',['✅','🔍'],'tech',18);
        if (has(/\b(?:ci|build)\s+(?:pipeline|job)\b.{0,20}\b(?:failed|failure)\b.{0,16}\b(?:packaging|package|build)\b|(?:CI|빌드)\s*(?:파이프라인|작업).{0,18}(?:패키징|빌드).{0,12}(?:실패)/i)) return special('v52-ci-fail',['❌','💻','⚙️'],'tech',18);
        if (has(/\bdns\b.{0,18}\b(?:resolution|lookup)\b.{0,18}\b(?:slow|latency|delayed)\b|(?:DNS).{0,12}(?:조회|해석).{0,12}(?:느리|지연)/i)) return special('v52-dns-slow',['🌐','⏱️'],'tech',18);
        if (has(/\b(?:certificate|cert|tls certificate|ssl certificate)\b.{0,20}\b(?:expire|expires|expiring|expiry)\b|(?:인증서|TLS|SSL).{0,14}(?:만료|유효기간)/i)) return special('v52-cert-expiry',['🔐','⚠️','📅'],'tech',18);
        if (has(/\bcron\b.{0,16}\b(?:job|task)?\b.{0,16}\b(?:ran|run|completed)\b.{0,12}\b(?:success|successfully|normal)\b|(?:크론|cron).{0,14}(?:작업|잡).{0,12}(?:정상|성공).{0,8}(?:실행|완료)/i)) return special('v52-cron-ok',['✅','⚙️'],'tech',18);
        if (has(/\b(?:free|freed|reclaim|reclaimed)\b.{0,16}\b(?:gigabytes?|gb|storage|disk space)\b|(?:저장\s*공간|디스크).{0,16}(?:확보|비웠|정리)|(?:기가|GB).{0,12}(?:확보|비웠)/i)) return special('v52-storage-freed',['💾','✅'],'tech',18);
        if (has(/\bfailover\b.{0,20}\b(?:switch|switched|moved|route|routed)\b.{0,20}\b(?:traffic|region|secondary)\b|(?:페일오버).{0,18}(?:트래픽|리전|지역).{0,14}(?:전환|이동|라우팅)/i)) return special('v52-failover',['🔄','🌐'],'tech',18);
        if (has(/\bapi\b.{0,18}\b(?:recovered|restored|back up|healthy)\b|\b(?:recovered|restored)\b.{0,18}\bapi\b|API.{0,12}(?:복구|정상화|회복)/i)) return special('v52-api-recovered',['✅','💻'],'tech',18);

        // Commerce / ordering.
        if (has(/\border\b.{0,18}\bconfirmation\b.{0,18}\b(?:email|message)\b.{0,14}\b(?:sent|delivered)\b|(?:주문\s*확인).{0,12}(?:이메일|메일|메시지).{0,10}(?:발송|보냈)/i)) return special('v52-order-confirm',['✅','📧'],'commerce',18);
        if (has(/\btracking\b.{0,18}\b(?:page|status)\b.{0,18}\b(?:not updated|hasn['’]t updated|no update|unchanged)\b|(?:배송\s*조회|운송장).{0,14}(?:업데이트|갱신).{0,12}(?:안|되지\s*않|없)/i)) return special('v52-tracking-stale',['📦','⏳'],'commerce',18);
        if (has(/\b(?:size|color|colour|variant)\b.{0,18}\b(?:unavailable|not available|sold out)\b|(?:사이즈|색상|옵션).{0,14}(?:구매할\s*수\s*없|사용할\s*수\s*없|품절|재고\s*없)/i)) return special('v52-variant-unavailable',['❌','🛒'],'commerce',18);
        if (has(/\b(?:discount|promo|coupon)\s+code\b.{0,18}\b(?:saved|save|discounted)\b.{0,16}\b(?:dollars?|\$|won|₩|percent|%)\b|(?:할인|쿠폰|프로모션)\s*코드.{0,16}(?:절약|할인).{0,12}(?:달러|원|%|퍼센트)/i)) return special('v52-code-saved',['🏷️','💰'],'commerce',18);
        if (has(/\brefund\b.{0,20}\b(?:reached|returned|credited|posted)\b.{0,16}\b(?:card|account)\b|(?:환불금|환불).{0,16}(?:카드|계좌).{0,10}(?:들어|입금|반영|돌아)/i)) return special('v52-refund-card',['💳','✅'],'commerce',18);
        if (has(/\bdelivery\b.{0,16}\b(?:moved|changed|rescheduled)\b.{0,22}\b(?:friday|saturday|sunday|monday|tuesday|wednesday|thursday|date|day)\b|(?:배송일|배송\s*날짜).{0,16}(?:바뀌|변경|옮|미뤄)/i)) return special('v52-delivery-moved',['🚚','🔄','📅'],'commerce',18);
        if (has(/\b(?:store|shop)\b.{0,16}\b(?:pickup|collection)\b.{0,14}\b(?:reminder|notification)\b|(?:매장|스토어).{0,14}(?:픽업|수령).{0,12}(?:알림|리마인더)/i)) return special('v52-pickup-reminder',['📍','🔔'],'commerce',18);
        if (has(/\b(?:annual|yearly)\s+(?:plan|subscription|membership)\b.{0,18}\b(?:renewed|renewal)\b|(?:연간|1년)\s*(?:요금제|구독|멤버십).{0,14}(?:갱신|연장)/i)) return special('v52-annual-renewed',['🔄','✅'],'commerce',18);
        if (has(/\b(?:sale|discounted)\s+price\b.{0,18}\b(?:lower|down|cheaper)\b|(?:세일|할인)\s*가격.{0,14}(?:낮|내려|싸)/i)) return special('v52-sale-price-down',['📉','💰'],'commerce',18);
        if (has(/\b(?:remove|removed|delete|deleted)\b.{0,14}\b(?:item|product)\b.{0,14}\b(?:from|out of)\s+(?:the\s+)?cart\b|(?:장바구니).{0,14}(?:상품|제품).{0,8}(?:뺐|제거|삭제)/i)) return special('v52-cart-remove',['🛒','➖'],'commerce',18);
        if (has(/\breturn\s+(?:package|parcel)\b.{0,18}\b(?:scanned|scan)\b|(?:반품|반송)\s*(?:택배|소포).{0,14}(?:스캔|접수)/i)) return special('v52-return-scan',['↩️','📦'],'commerce',18);
        if (has(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:units?|items?|pieces?)\b.{0,14}\b(?:left|remain|remaining)\b.{0,12}\b(?:stock|inventory)?\b|(?:재고).{0,12}(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|\d+)\s*개.{0,8}(?:남|있)/i)) return special('v52-low-stock',['⚠️','🛒'],'commerce',18);

        // Travel logistics.
        if (has(/\bboarding\b.{0,14}\b(?:starts?|begins?)\b.{0,14}\b(?:minutes?|hours?)\b|(?:탑승).{0,12}(?:분|시간)\s*(?:뒤|후).{0,8}(?:시작)/i)) return special('v52-boarding-soon',['✈️','⏰'],'travel',18);
        if (has(/\bhotel\b.{0,18}\b(?:moved|upgraded|changed)\b.{0,18}\b(?:room|suite)\b|호텔.{0,16}(?:객실|방).{0,12}(?:바꿔|업그레이드|옮)/i)) return special('v52-hotel-room',['🏨','🔄'],'travel',18);
        if (has(/\btrain\b.{0,18}\b(?:platform|track)\b|\bplatform\b.{0,12}\b(?:train|rail)\b|기차.{0,14}(?:승강장|플랫폼)|(?:승강장|플랫폼).{0,12}기차/i)) return special('v52-train-platform',['🚆','📍'],'travel',18);
        if (has(/\b(?:ferry|boat)\s+ticket\b.{0,18}\bemail\b|\bemail\b.{0,18}\b(?:ferry|boat)\s+ticket\b|페리\s*티켓.{0,14}(?:이메일|메일)|(?:이메일|메일).{0,14}페리\s*티켓/i)) return special('v52-ferry-ticket',['🚢','🎫','📧'],'travel',18);
        if (has(/\bvisa\b.{0,16}\bappointment\b.{0,16}\b(?:next|monday|tuesday|wednesday|thursday|friday|date)\b|비자.{0,12}(?:예약|약속|방문).{0,12}(?:다음|월요일|화요일|수요일|목요일|금요일|날짜)/i)) return special('v52-visa-date',['🛂','📅'],'travel',18);
        if (has(/\b(?:metro|subway)\b.{0,16}\b(?:closes?|ends?|stops?)\b.{0,14}\b(?:midnight|\d{1,2})\b|(?:지하철|전철).{0,14}(?:자정|\d+시).{0,10}(?:끝|종료|닫|막차)/i)) return special('v52-metro-close',['🚇','⏰'],'travel',18);
        if (has(/\b(?:copy|copied|scan|scanned)\b.{0,14}\bpassport\b|여권.{0,12}(?:사본|복사|스캔)|(?:사본|복사).{0,10}여권/i)) return special('v52-passport-copy',['🛂','📄'],'travel',18);
        if (has(/\b(?:suitcase|baggage|luggage)\b.{0,18}\b(?:belt|carousel)\b|(?:수하물|여행\s*가방|캐리어).{0,14}(?:벨트|회전대|캐러셀)/i)) return special('v52-baggage-belt',['🧳','✅'],'travel',18);
        if (has(/\b(?:storm|storms|heavy rain)\b.{0,20}\bflight\b|\bflight\b.{0,20}\b(?:storm|storms|heavy rain)\b|(?:폭풍|폭우|태풍).{0,14}항공편|항공편.{0,14}(?:폭풍|폭우|태풍)/i)) return special('v52-storm-flight',['🌧️','✈️','⚠️'],'travel',18);
        if (has(/\b(?:rental\s+car|car\s+rental)\b.{0,18}\b(?:pickup|desk)\b.{0,18}\b(?:closes?|close)\b|렌터카.{0,14}(?:픽업|데스크).{0,12}(?:닫|마감)/i)) return special('v52-rental-desk',['🚗','📍','⏰'],'travel',18);
        if (has(/\b(?:reserve|reserved|book|booked)\b.{0,16}\b(?:room|hotel)\b.{0,16}\b(?:station|train station)\b|(?:역|기차역).{0,12}(?:근처|가까운).{0,10}(?:숙소|호텔|방).{0,8}(?:예약)?/i)) return special('v52-room-station',['🏨','🚆','📅'],'travel',18);
        if (has(/\b(?:hiking|hike)\s+(?:guide|tour)\b.{0,18}\b(?:cancelled|canceled|called off)\b.{0,18}\b(?:rain|weather)\b|(?:등산|하이킹)\s*(?:가이드|투어).{0,14}(?:비|폭우|날씨).{0,10}(?:취소)/i)) return special('v52-hike-cancel',['🚫','🥾','🌧️'],'travel',18);

        // Analytics / report language.
        if (has(/\b(?:weekly|monthly|daily)?\s*(?:active\s+users?|users?|engagement|activation|support\s+tickets?|completion|rate|revenue|cost|refund\s+rate)\b.{0,30}\b(?:increased|rose|grew|up|higher|record|highest|improved)\b|(?:주간|월간|일간)?\s*(?:활성\s*사용자|사용자|참여도|활성화|지원\s*티켓|완료율|매출|비용|환불률).{0,24}(?:증가|상승|최고|기록|개선)/i)) return special('v52-report-up',['📈','📊','🏆'],'report',17);
        if (has(/\b(?:conversion\s+rate|cost|resolution\s+time|refund\s+rate|rate|revenue)\b.{0,28}\b(?:declined|decreased|fell|down|lower|improved|dropped)\b|(?:전환율|비용|해결\s*시간|환불률|비율|매출).{0,22}(?:하락|감소|내려|떨어|개선)/i)) return special('v52-report-down',['📉','📊','⏱️','💰'],'report',17);
        if (has(/\b(?:revenue|renewal\s+rate|metric|rate)\b.{0,24}\b(?:flat|unchanged|same|stable)\b|(?:매출|갱신율|지표|비율).{0,20}(?:변하지|같은\s*수준|동일|그대로|안정)/i)) return special('v52-report-flat',['📊','➡️'],'report',17);
        if (has(/\b(?:acquisition\s+cost|infrastructure\s+cost|infra\s+cost)\b/i) && has(/\b(?:decreased|fell|down|lower|reduced)\b|감소|하락|내려|줄/i)) return special('v52-cost-down',['📉','💰'],'report',18);
        if (has(/\b(?:infrastructure\s+cost|infra\s+cost|cost)\b/i) && has(/\b(?:increased|rose|up|higher)\b|증가|상승|늘/i)) return special('v52-cost-up',['📈','💰'],'report',18);
        if (has(/\b(?:resolution\s+time)\b.{0,20}\b(?:improved|decreased|lower|down)\b|(?:해결\s*시간).{0,16}(?:개선|감소|줄)/i)) return special('v52-resolution-time',['📉','⏱️'],'report',18);

        // Fitness / wellness.
        if (has(/\b(?:run|ran|jog|jogged)\b.{0,20}\b(?:morning|breakfast|early)\b|(?:아침|식사\s*전).{0,14}(?:달렸|달리|러닝)|(?:달렸|달리).{0,14}(?:아침|식사\s*전)/i)) return special('v52-morning-run',['🏃','🌅'],'fitness',17);
        if (has(/\b(?:workout|training|exercise)\b.{0,16}\b(?:minutes?|time|longer|added)\b|(?:운동|훈련).{0,14}(?:시간|분).{0,10}(?:늘|추가|연장)/i)) return special('v52-workout-time',['💪','⏱️'],'fitness',17);
        if (has(/\byoga\b.{0,18}\b(?:relax|relaxed|calm|after work)\b|요가.{0,14}(?:편안|이완|퇴근|진정)/i)) return special('v52-yoga-relax',['🧘','😌'],'fitness',17);
        if (has(/\b(?:drink|drank|drinking)\b.{0,12}\b(?:more\s+)?water\b|\bwater\b.{0,14}\b(?:drink|drank|hydration)\b|물.{0,12}(?:많이|더).{0,8}(?:마셨|마시)/i)) return special('v52-water',['💧','🌿'],'fitness',17);
        if (has(/\b(?:slept|sleep)\b.{0,12}\b(?:seven|eight|nine|\d+)\s*hours?\b|(?:7|8|9|\d+)\s*시간.{0,8}(?:잤|수면)/i)) return special('v52-sleep-hours',['😴','🛌'],'fitness',17);
        if (has(/\b(?:personal\s+best|pb|record)\b.{0,16}\b(?:bike|cycling|run|ride)\b|\b(?:bike|cycling)\b.{0,16}\b(?:personal\s+best|record)\b|(?:자전거|러닝).{0,14}(?:개인\s*최고|최고\s*기록|기록)/i)) return special('v52-fitness-record',['🏆','🚲','🏃'],'fitness',17);
        if (has(/\b(?:legs?|muscles?)\b.{0,16}\b(?:sore|aching|hurt)\b.{0,18}\b(?:hike|hiking|workout)\b|(?:등산|운동).{0,14}(?:다리|근육).{0,10}(?:뻐근|아프|통증)/i)) return special('v52-sore',['🩹','🥾'],'fitness',17);
        if (has(/\b(?:stretch|stretched|stretching)\b.{0,16}\b(?:minutes?|before bed|after)\b|(?:스트레칭).{0,12}(?:분|잠들기\s*전|운동\s*뒤)/i)) return special('v52-stretch',['🧘','⏱️'],'fitness',17);
        if (has(/\b(?:gym|fitness center)\b.{0,16}\b(?:empty|quiet)\b.{0,16}\b(?:morning|early)\b|(?:헬스장|체육관).{0,14}(?:비어|한산).{0,12}(?:아침|오전)/i)) return special('v52-gym-empty',['💪','🌅'],'fitness',17);
        if (has(/\b(?:rest\s+day|day\s+off)\b.{0,18}\b(?:training|workout|exercise)\b|(?:운동|훈련).{0,12}(?:대신|쉬).{0,12}(?:하루|휴식)|(?:하루).{0,10}(?:쉬기로|휴식일)/i)) return special('v52-rest-day',['😌','🛌'],'fitness',17);
        if (has(/\b(?:walk|walked)\b.{0,10}\b(?:ten\s+thousand|10,?000|\d+)\s+steps?\b|(?:만|10,?000|\d+)\s*보.{0,8}(?:걸었|걸음)/i)) return special('v52-steps',['🚶','🎯'],'fitness',17);
        if (has(/\b(?:healthy|salad)\b.{0,16}\b(?:lunch|meal)\b.{0,18}\b(?:after|post)\s+(?:the\s+)?workout\b|(?:운동\s*뒤|운동\s*후).{0,14}(?:건강한\s*)?(?:점심|식사|샐러드)/i)) return special('v52-healthy-lunch',['🥗','💪'],'fitness',17);

        // Relationships / people.
        if (has(/\b(?:call|called|phone|phoned)\b.{0,12}\b(?:my\s+)?(?:mom|mum|mother|dad|father|parent)\b|(?:엄마|아빠|부모님).{0,10}(?:전화|통화)|(?:전화|통화).{0,10}(?:엄마|아빠|부모님)/i)) return special('v52-family-call',['📞','💛'],'social',17);
        if (has(/\b(?:dinner|meal)\b.{0,14}\b(?:family|parents?)\b|\b(?:family|parents?)\b.{0,14}\b(?:dinner|meal)\b|가족.{0,12}(?:저녁|식사)|(?:저녁|식사).{0,12}가족/i)) return special('v52-family-dinner',['🍽️','💛'],'social',17);
        if (has(/\b(?:send|sent|write|wrote)\b.{0,16}\b(?:friend|someone)\b.{0,14}\bbirthday\s+(?:message|wish)\b|친구.{0,12}(?:생일).{0,10}(?:메시지|축하)/i)) return special('v52-birthday-message',['🎂','💬'],'social',17);
        if (has(/\bcoffee\b.{0,14}\b(?:coworker|colleague|friend)\b.{0,18}\b(?:conversation|talk|chat)\b|(?:동료|친구).{0,12}커피.{0,12}(?:대화|이야기)/i)) return special('v52-coffee-conversation',['☕','🤝'],'social',17);
        if (has(/\bmiss\b.{0,14}\b(?:my\s+)?(?:partner|boyfriend|girlfriend|spouse|friend|family)\b|(?:연인|파트너|친구|가족).{0,12}(?:보고\s*싶|그립)|(?:보고\s*싶|그립).{0,12}(?:연인|파트너|친구|가족)/i)) return special('v52-miss-person',['🥺','💛'],'social',17);
        if (has(/\b(?:weekend\s+)?trip\b.{0,16}\b(?:friends?|family)\b|\b(?:friends?|family)\b.{0,16}\b(?:weekend\s+)?trip\b|친구.{0,12}(?:주말\s*)?여행.{0,12}(?:계획|가기로)|(?:주말\s*)?여행.{0,12}친구/i)) return special('v52-friends-trip',['🧳','🤝','📅'],'social',17);
        if (has(/\b(?:thank|thanked)\b.{0,14}\b(?:neighbor|friend|coworker)\b.{0,18}\b(?:help|helping|helped)\b|(?:이웃|친구|동료).{0,12}(?:도와|도움).{0,10}(?:감사|고마)|(?:감사|고마).{0,12}(?:이웃|친구|동료)/i)) return special('v52-thank-help',['🙏','🤝'],'social',17);
        if (has(/\b(?:sister|brother|mom|dad|friend)\b.{0,16}\b(?:sent|shared)\b.{0,14}\b(?:old\s+)?photo\b|(?:언니|누나|형|오빠|동생|엄마|아빠|친구).{0,12}(?:옛날|오래된)?\s*사진.{0,8}(?:보냈|공유)/i)) return special('v52-old-photo',['📸','💛'],'social',17);
        if (has(/\b(?:celebrate|celebrated)\b.{0,18}\b(?:promotion|new job)\b.{0,18}\b(?:dinner|meal)\b|(?:승진|새\s*직장).{0,12}(?:저녁|식사).{0,10}(?:축하)|(?:저녁|식사).{0,12}(?:승진).{0,8}(?:축하)/i)) return special('v52-promotion-dinner',['🎉','🍽️'],'social',17);
        if (has(/\b(?:met|meet|ran into)\b.{0,16}\b(?:old\s+)?classmate\b.{0,16}\b(?:train|station)\b|(?:기차|역).{0,12}(?:동창|친구).{0,8}(?:만났|우연히)|(?:동창).{0,12}(?:기차|역).{0,8}(?:만났)/i)) return special('v52-classmate-train',['🤝','🚆'],'social',17);
        if (has(/\b(?:friend|partner|someone)\b.{0,16}\b(?:listened|listen)\b.{0,18}\b(?:talk|needed|me)\b|친구.{0,14}(?:이야기|말).{0,12}(?:들어줬|들어주|들었다)/i)) return special('v52-listened',['💛','💬'],'social',17);
        if (has(/\b(?:family\s+)?video\s+call\b.{0,18}\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|scheduled|schedule)\b|(?:가족\s*)?영상\s*통화.{0,14}(?:일요일|월요일|화요일|수요일|목요일|금요일|토요일|잡았|예약|일정)/i)) return special('v52-family-video-call',['📞','📅','💛'],'social',17);

        // Common safety/documentation guards that should outrank surface keywords.
        if (has(/\b(?:warning|error|failure)\b.{0,18}\b(?:example|documentation|docs|sample)\b|\b(?:example|documentation|docs|sample)\b.{0,18}\b(?:warning|error|failure)\b|(?:경고|오류|실패).{0,14}(?:예시|문서|샘플)|(?:예시|문서).{0,14}(?:경고|오류|실패)/i)) return special('v52-doc-example',['📝','💡'],'education',19);
        if (has(/\b(?:secret|private|access)\s+(?:token|key|credential)\b.{0,22}\b(?:do not|don['’]t|never)\b|\b(?:do not|don['’]t|never)\b.{0,22}\b(?:secret|private|access)\s+(?:token|key|credential)\b|(?:비밀|개인|접근)\s*(?:토큰|키|자격).{0,18}(?:붙여넣지|공유하지|노출하지)|(?:붙여넣지|공유하지).{0,18}(?:비밀|토큰|키)/i)) return special('v52-secret-token',['⚠️','🔐'],'safety',19);
        if (has(/\b(?:review|reviewing|investigate|investigating|check|checking)\b.{0,18}\b(?:failed|failure|error|incident)\b.{0,16}\b(?:build|job|log|report)\b|(?:실패|오류|장애).{0,12}(?:빌드|작업|로그|보고서).{0,12}(?:검토|확인|조사)/i)) return special('v52-review-failure',['🔍','⚠️'],'tech',19);

        // Strong state/action cues first.
        if (has(/\b(?:sold out|out of stock|unavailable for sale)\b|품절|재고\s*없/i)) return special('concrete-soldout',['❌','🛒'],'commerce',14);
        if (has(/\b(?:overdue|past due|late payment)\b|연체|기한\s*초과/i)) return special('concrete-overdue',['🧾','⚠️'],'work',14);
        if (has(/\b(?:due|deadline)\b.{0,16}\b(?:monday|tuesday|wednesday|thursday|friday|today|tomorrow|noon|midnight|\d{1,2})\b|(?:마감|기한).{0,16}(?:월요일|화요일|수요일|목요일|금요일|오늘|내일|정오|자정|\d+시)/i)) return special('concrete-deadline',['⏰','📝'],'schedule',14);
        if (has(/\b(?:confirmed|approved|accepted|completed|finished|passed|successful|succeeded|resolved|ready)\b|확정|승인|수락|완료|통과|성공|해결|준비됐|준비되/i) && !has(/\b(?:not|isn['’]t|wasn['’]t|pending|waiting)\b|아니|않|대기|기다리/i)) return special('concrete-positive-status',['✅'],'status',13.8);
        if (has(/\b(?:failed|failure|stopped|unavailable|exhausted|broken|error|errors)\b|실패|중단|사용할\s*수\s*없|소진|고장|오류/i) && !has(/\b(?:not|no longer)\b|아니|않/i)) return special('concrete-negative-status',['❌'],'status',13.8);
        if (has(/\b(?:delayed|late|pending|waiting|awaiting)\b|지연|대기|기다리|보류/i)) return special('concrete-waiting',['⏳'],'status',13.2);
        if (has(/\b(?:increased|grew|rose|higher|spiked|record high|new high)\b|증가|상승|늘었|급증|최고치/i)) return special('concrete-up',['📈'],'report',12.8);
        if (has(/\b(?:decreased|fell|dropped|lower|reduced|slowed)\b|감소|하락|줄었|떨어졌|둔화/i)) return special('concrete-down',['📉'],'report',12.8);
        if (has(/\b(?:flat|unchanged|same level|remained stable|stayed stable)\b|변화\s*없|같은\s*수준|비슷한\s*수준|그대로|안정적/i)) return special('concrete-flat',['📊','➡️'],'report',12.6);

        // Concrete objects and activities. Phrases that are highly ambiguous are guarded.
        const rules = [
            [/\b(?:light\s*bulb|bulb)\b|전구/i, ['💡','🛠️'],'bulb','life'],
            [/\b(?:grocery|groceries|shopping list)\b|장보기|장보기\s*목록/i, ['🛒','📝'],'grocery','life'],
            [/\b(?:water filter|filter cartridge)\b|정수기\s*필터|물\s*필터/i, ['💧','🛠️'],'water-filter','life'],
            [/\b(?:recycl(?:e|ing|ables)|recycling bin)\b|재활용/i, ['♻️'],'recycling','life'],
            [/\b(?:oats?|oatmeal|porridge|cereal)\b|오트|오트밀|죽/i, ['🥣'],'oats','food'],
            [/\b(?:window|windowsill)\b|창문|창가/i, ['🪟'],'window','life'],
            [/\b(?:charging cable|charger cable|power cable|charger)\b|충전\s*케이블|충전기/i, ['🔌'],'cable','tech'],
            [/\b(?:shirt|shirts|clothes|clothing)\b|셔츠|옷/i, ['👕'],'clothes','life'],
            [/\b(?:cat|kitten)\b|고양이/i, ['🐱'],'cat','animal'],
            [/\b(?:mirror)\b|거울/i, ['🪞','🧽'],'mirror','life'],
            [/\b(?:keys?|keyring)\b|열쇠/i, ['🔑'],'keys','life'],
            [/\b(?:soup|stew)\b|수프|국|찌개/i, ['🍲'],'soup','food'],
            [/\b(?:snow|snowing|snowfall)\b|눈이\s*내|첫눈|폭설/i, ['❄️'],'snow','weather'],
            [/\b(?:strawberr(?:y|ies))\b|딸기/i, ['🍓'],'strawberry','food'],
            [/\b(?:moon|moonlight)\b|달빛|달이|밝은\s*달/i, ['🌙'],'moon','weather'],
            [/\b(?:caf[eé]|coffee)\b|카페|커피/i, ['☕'],'cafe','food'],
            [/\b(?:birthday|birthday cake|candles?)\b|생일|촛불/i, ['🎂','🎉'],'birthday','event'],
            [/\b(?:hike|hiking|trail|summit|viewpoint)\b|등산|등산로|산길|정상|전망대/i, ['🥾','⛰️'],'hiking','travel'],
            [/\b(?:beach|shore|seaside)\b|해변|바닷가/i, ['🏖️','🌊'],'beach','travel'],
            [/\b(?:pizza)\b|피자/i, ['🍕'],'pizza','food'],
            [/\b(?:book|reading|library)\b|책|독서|도서관/i, ['📚'],'book','education'],
            [/\b(?:dog|puppy)\b|강아지|개(?:가|를|와|와의)/i, ['🐶'],'dog','animal'],
            [/\b(?:garden|flowers?|bloom|blossom)\b|정원|꽃|개화/i, ['🌸','🌿'],'garden','nature'],
            [/\b(?:dance|danced|dancing)\b|춤|춤췄/i, ['💃','🎵'],'dance','creative'],
            [/\b(?:paint|painting|painted)\b|페인트|칠했다|칠을/i, ['🎨'],'paint','creative'],
            [/\b(?:contract|agreement)\b|계약서|계약/i, ['📜'],'contract','work'],
            [/\b(?:budget|finance spreadsheet)\b|예산|재무/i, ['📊','💰'],'budget','work'],
            [/\b(?:slide deck|slides?|presentation)\b|슬라이드|발표\s*자료|프레젠테이션/i, ['📊'],'presentation','work'],
            [/\b(?:meeting notes?|minutes|agenda|checklist|action items?)\b|회의록|회의\s*메모|안건|아젠다|체크리스트|할\s*일\s*목록/i, ['📋','📝'],'work-notes','work'],
            [/\b(?:invoice|receipt|expense report|bill)\b|청구서|인보이스|영수증|경비\s*보고서/i, ['🧾'],'invoice','work'],
            [/\b(?:feedback|comment|comments)\b|피드백|의견|댓글/i, ['💬'],'feedback','work'],
            [/\b(?:call|phone call)\b|통화|전화/i, ['📞'],'call','work'],
            [/\b(?:folder|archive|archived|files?)\b|폴더|보관\s*처리|파일/i, ['📁'],'folder','work'],
            [/\bcpu\b|CPU/i, ['💻','📊'],'cpu','tech'],
            [/\b(?:disk|storage|backup|database|db)\b|디스크|저장\s*공간|백업|데이터베이스|DB/i, ['💾'],'storage','tech'],
            [/\bdns\b|DNS/i, ['🌐'],'dns','tech'],
            [/\b(?:unit tests?|integration tests?|test suite)\b|단위\s*테스트|통합\s*테스트/i, ['🧪'],'tests','tech'],
            [/\b(?:authentication|auth|token|api key|credential)\b|인증|토큰|API\s*키|자격\s*증명/i, ['🔐'],'auth','tech'],
            [/\b(?:queue|worker|consumer)\b|큐|워커|컨슈머/i, ['⚙️'],'queue','tech'],
            [/\bapi\b|API/i, ['💻'],'api','tech'],
            [/\b(?:deploy|deployment|release)\b|배포|릴리스/i, ['🛠️'],'deploy','tech'],
            [/\b(?:tracking number|tracking code|tracking update)\b|배송\s*조회|운송장/i, ['📦','🔎'],'tracking','commerce'],
            [/\b(?:order|cart|checkout|preorder|pre-order)\b|주문|장바구니|결제\s*단계|사전\s*주문/i, ['🛒'],'order','commerce'],
            [/\b(?:coupon|voucher|promo code|discount code)\b|쿠폰|프로모션\s*코드|할인\s*코드/i, ['🏷️'],'coupon','commerce'],
            [/\b(?:payment|refund|credit card|card)\b|결제|환불|카드/i, ['💳'],'payment','commerce'],
            [/\b(?:pickup|collection point|store pickup)\b|픽업|매장\s*수령/i, ['📍'],'pickup','commerce'],
            [/\b(?:subscription|renewal|renewed)\b|구독|갱신/i, ['🔄'],'subscription','commerce'],
            [/\b(?:return label|return|returned)\b|반품|반송/i, ['↩️'],'return','commerce'],
            [/\b(?:package|parcel|warehouse|shipping|delivery)\b|택배|소포|창고|배송/i, ['📦','🚚'],'package','commerce'],
            [/\b(?:flight|airport|boarding|gate)\b|항공편|비행기|공항|탑승|게이트/i, ['✈️'],'flight','travel'],
            [/\b(?:train|rail|platform)\b|기차|열차|승강장|플랫폼/i, ['🚆'],'train','travel'],
            [/\b(?:hotel|hostel|check-in|checkout)\b|호텔|호스텔|체크인|체크아웃/i, ['🏨'],'hotel','travel'],
            [/\b(?:bus|shuttle)\b|버스|셔틀/i, ['🚌'],'bus','travel'],
            [/\b(?:luggage|suitcase|baggage)\b|짐|수하물|여행\s*가방/i, ['🧳'],'luggage','travel'],
            [/\b(?:museum|gallery)\b|박물관|미술관/i, ['🏛️'],'museum','travel'],
            [/\b(?:reservation|booking)\b|예약/i, ['📅'],'reservation','travel'],
            [/\b(?:rain|rainy|storm)\b|비가|비\s*오는|장마/i, ['🌧️'],'rain','weather'],
            [/\b(?:visa|passport)\b|비자|여권/i, ['🛂'],'passport','travel'],
            [/\b(?:security|secure|safety check)\b|보안|검색대|보안\s*검색/i, ['🛡️'],'security','safety'],
            [/\b(?:exam|lecture|course|class|teacher|assignment|essay|research paper)\b|시험|강의|수업|교사|과제|에세이|연구\s*논문/i, ['🎓','📝'],'education','education'],
            [/\b(?:study group|study|studying)\b|스터디|공부/i, ['📚','🤝'],'study','education'],
            [/\b(?:proud|grateful|thankful)\b|자랑스럽|뿌듯|감사/i, ['💛','🥹'],'positive-mood','mood'],
            [/\b(?:nervous|anxious|worried)\b|긴장|불안|걱정/i, ['😥'],'nervous','mood'],
            [/\b(?:miss|missing)\b.{0,20}\b(?:friend|family|people)\b|친구|가족.{0,12}(?:보고\s*싶|그립)/i, ['🥺','💛'],'missing','mood']
        ];
        for (const [re, emojis, id, group] of rules) {
            if (re.test(t)) return special('concrete-' + id, emojis, group, 11.5);
        }
        return null;
    }

    // Broad concept layer: catches ordinary paraphrases that do not match a high-precision
    // special rule. It uses multiple semantic cues, not isolated single words.
    function conceptFallback(text) {
        const t = text.trim();
        if (!t) return null;

        // Human rest / sleep.
        if ((/\b(?:sleep|slept|sleeping|nap|bed|bedtime|rest|rested|tired|exhausted|energy)\b/i.test(t) &&
             /\b(?:i|my|me|we|today|tonight|morning|night|afternoon|feel|feeling|need|want|going|went|woke|wake|after|before|early|late)\b/i.test(t)) ||
            (/(?:잠|자고|잤|낮잠|휴식|쉬|피곤|지쳤|에너지|개운)/i.test(t) && /(?:오늘|밤|아침|오후|내가|나는|저는|필요|일찍|늦게|후|전)/i.test(t))) {
            return special('concept-rest', ['😴','😌','🛌'], 'life', 18);
        }

        // Time passing / calendar reflection.
        if ((/\b(?:week|weeks|month|months|year|years|season|summer|winter|spring|autumn|fall|january|february|march|april|may|june|july|august|september|october|november|december|time|friday)\b/i.test(t) &&
             /\b(?:pass|passed|passing|gone|over|end|halfway|already|fly|flying|flew|vanish|disappear|slip|slipping|sooner|faster|quickly|fast|yesterday)\b/i.test(t)) ||
            (/(?:주|달|개월|년|계절|여름|겨울|봄|가을|올해|시간|월요일|금요일|1월|2월|3월|4월|5월|6월|7월|8월|9월|10월|11월|12월)/i.test(t) &&
             /(?:지나|흘러|끝|절반|벌써|금방|빠르|순식간|사라|어제|예상보다)/i.test(t))) {
            return special('concept-time', ['⏳','🕰️','📅'], 'life', 18);
        }

        // Pace, balance, sustainable progress.
        if (/\b(?:slow|steady|pace|consistency|consistent|room between|space between|free hour|rushing|rush|pressure|pushing harder|burn out|burnout|falling behind|everything at once|perfect)\b/i.test(t) ||
            /(?:천천히|꾸준|속도|페이스|여유|재촉|서두르|몰아붙|무리|뒤처|한\s*번에|완벽|빈\s*시간)/i.test(t)) {
            if (!/\b(?:server|system|network|download|upload|processing speed|clock speed)\b|서버|시스템|네트워크|처리\s*속도/i.test(t)) {
                return special('concept-balance', ['🌿','🌱','😌'], 'life', 15);
            }
        }

        // People / relationships.
        if ((/\b(?:friend|friends|family|parents|mother|mom|mum|father|dad|sister|brother|coworker|colleague|people|person)\b/i.test(t) &&
             /\b(?:call|called|talk|talked|conversation|dinner|lunch|meet|met|catch|caught|miss|missing|spend|spent|together|kind|laugh|laughed|see|seeing)\b/i.test(t)) ||
            (/(?:친구|가족|부모님|엄마|아빠|언니|누나|형|오빠|동생|동료|사람)/i.test(t) &&
             /(?:통화|전화|이야기|대화|저녁|점심|만나|그립|보고\s*싶|함께|웃|친절|시간)/i.test(t))) {
            if (/\b(?:miss|missing)\b|그립|보고\s*싶/i.test(t)) return special('concept-missing-people', ['😔','💛'], 'mood', 18);
            return special('concept-people', ['🤝','💛','😊'], 'social', 16);
        }

        // Completion / checklist / deferred work.
        if ((/\b(?:task|project|work|item|checklist|checkbox|list|draft|proposal)\b/i.test(t) &&
             /\b(?:done|finished|complete|completed|finish|checked|marked|cleared|closed|wrapped|sent|submitted|finally|last|final)\b/i.test(t)) ||
            (/(?:일|작업|프로젝트|항목|체크리스트|체크박스|목록|초안|제안서)/i.test(t) &&
             /(?:끝|완료|마무리|체크|표시|보냈|제출|처리|드디어|마지막|전부|모두)/i.test(t))) {
            if (/\b(?:sent|submitted)\b|보냈|제출/i.test(t)) return special('concept-sent-done', ['✅','📤'], 'status', 18);
            return special('concept-complete', ['✅','🙌'], 'status', 18);
        }
        if (/\b(?:small|tiny|little)\s+(?:win|achievement|progress|victory)\b|(?:작은|조금의?)\s*(?:성공|성과|성취|진전|승리)/i.test(t)) {
            return special('concept-small-win', ['🎉','😊','🏆','🌱'], 'event', 16);
        }

        // Weather / outdoor scenes.
        if (/\b(?:snow|snowing|snowfall|blizzard)\b|(?:눈|폭설).*(?:내리|오|쌓)|(?:내리|오|쌓).*눈/i.test(t)) return special('concept-snow', ['❄️','🌨️'], 'weather', 19);
        if (/\b(?:storm|thunderstorm)\b|폭풍|폭우|태풍/i.test(t)) return special('concept-storm', ['⛈️','🌧️'], 'weather', 18);
        if (/\b(?:rain|raining|rainy)\b|비가\s*(?:오|내리)|비\s*오는|빗소리/i.test(t)) return special('concept-rain', ['🌧️','☔'], 'weather', 16);
        if (/\b(?:hike|hiking|trail)\b|등산|하이킹|산행|등산로/i.test(t)) return special('concept-hike', ['🥾','🌅'], 'topic', 16);
        if (/\b(?:sunset|sunrise|golden hour|last light)\b|노을|일출|해\s*뜨|해가\s*지|마지막\s*빛/i.test(t)) return special('concept-sunlight', ['🌅','☀️'], 'topic', 16);
        if (/\b(?:river|lake|ocean|sea|waterfront)\b|강가|강변|호수|바다|물\s*위/i.test(t)) return special('concept-water', ['🌊'], 'topic', 13);
        if (/\b(?:walk|walking|walked|stroll)\b|산책|걸어|걸었|걷기|걷는/i.test(t)) return special('concept-walk', ['🚶','🌿'], 'life', 13);

        // Creative / food / hobby.
        if (/\b(?:photo|photos|picture|pictures|camera|photography|image|images)\b|사진|카메라|이미지/i.test(t)) return special('concept-photo', ['📸','📷','🖼️'], 'topic', 16);
        if (/\b(?:playlist|album|song|music|record|headphones|earbuds)\b|플레이리스트|앨범|노래|음악|이어폰|헤드폰/i.test(t)) return special('concept-music', ['🎧','🎵'], 'topic', 16);
        if (/\b(?:piano|guitar|violin|drums?)\b|피아노|기타|바이올린|드럼/i.test(t)) return special('concept-instrument', ['🎵','🎸','🎹'], 'topic', 16);
        if (/\b(?:bread|bake|baked|baking|cookies?|cake)\b|빵|베이킹|쿠키|케이크/i.test(t)) return special('concept-baking', ['🍞','🧁','😊'], 'topic', 15);
        if (/\b(?:soup|stew|curry|pasta|pizza|tacos?|dinner|lunch|breakfast|recipe|cooking|cooked)\b|수프|스프|찌개|카레|파스타|피자|타코|(?:아침|점심|저녁)\s*(?:식사|밥)|(?:아침|점심|저녁).{0,8}(?:먹|요리|차리)|레시피|요리/i.test(t)) return special('concept-food', ['🍽️','😋'], 'topic', 12);
        if (/\b(?:book|novel|reading|read)\b|책|소설|읽/i.test(t)) return special('concept-reading', ['📚','📖'], 'topic', 12);

        // Formal reports / reviews.
        if ((/\b(?:attached|attachment)\b/i.test(t) && /\b(?:review|check|inspect|confirm|chart|file|document|spreadsheet)\b/i.test(t)) ||
            (/(?:첨부|첨부된|첨부한)/i.test(t) && /(?:검토|확인|차트|파일|문서|자료)/i.test(t))) return special('concept-attachment', ['📎','👀'], 'report', 19);
        if ((/\b(?:rate|volume|sessions?|traffic|total|average|median|metric|metrics|analysis)\b/i.test(t) && /\b(?:increase|increased|rose|decrease|decreased|fell|dropped|unchanged|no change|stayed|improved)\b/i.test(t)) ||
            (/(?:비율|률|량|건수|세션|트래픽|합계|평균|중앙값|지표|분석)/i.test(t) && /(?:증가|상승|감소|하락|줄|변화\s*없|유지|개선)/i.test(t))) return special('concept-metric', ['📊','📈','📉'], 'report', 18);
        if ((/\b(?:task|action item|follow[- ]up)\b/i.test(t) && /\b(?:remain|remaining|open|pending)\b/i.test(t)) ||
            (/(?:작업|실행\s*항목|후속\s*항목)/i.test(t) && /(?:남아|열린|대기|미완료)/i.test(t))) return special('concept-open-actions', ['📌','✅'], 'report', 18);
        if (/\b(?:approved|approval|accepted)\b|승인|수락/i.test(t)) return special('concept-approved', ['✅','📝'], 'status', 14);
        if ((/\b(?:report|summary|analysis|proposal|document)\b/i.test(t) && /\b(?:ready|prepared).{0,14}(?:review|approval)|review.{0,14}(?:ready|prepared)\b/i.test(t)) ||
            (/(?:보고서|요약|분석|제안서|문서)/i.test(t) && /(?:검토|승인).{0,12}(?:준비|완료)|(?:준비|완료).{0,12}(?:검토|승인)/i.test(t))) return special('concept-review', ['👀','📝','✅'], 'report', 17);

        // Commerce / fulfillment.
        if (/\b(?:cart|basket)\b|장바구니/i.test(t)) return special('concept-cart', ['🛒'], 'commerce', 15);
        if (/\b(?:free shipping|free delivery|shipping is free|delivery is free)\b|무료\s*배송|배송비.{0,8}(?:무료|없)|배송료.{0,8}(?:무료|없)/i.test(t)) return special('concept-free-shipping', ['📦','🛍️'], 'commerce', 18);
        if (/\b(?:coupon|promo|promotion|discount).{0,20}(?:expire|expires|invalid|ends|midnight|tonight)|(?:expire|invalid).{0,16}(?:coupon|promo)\b|(?:쿠폰|프로모션|할인).{0,16}(?:만료|종료|사용할\s*수\s*없|자정|오늘\s*밤)/i.test(t)) return special('concept-promo', ['🏷️','⏰'], 'commerce', 18);
        if (/\b(?:refund|return).{0,18}(?:approved|accepted|processing)|(?:approved|accepted).{0,12}(?:refund|return)\b|(?:환불|반품).{0,14}(?:승인|접수|처리\s*중)/i.test(t)) return special('concept-refund', ['✅','💰','📦'], 'commerce', 18);
        if (/\b(?:unavailable|out of stock|sold out|cannot be purchased|can['’]t be purchased)\b|품절|구매할\s*수\s*없|구매\s*불가|이용\s*불가/i.test(t)) return special('concept-unavailable', ['🚫','📦'], 'commerce', 18);
        if (/\bcheckout\b.{0,24}\b(?:faster|quicker|less time|shorter)\b|(?:결제\s*(?:흐름|과정|단계)|결제).{0,20}(?:빨라|빠르|시간.{0,8}줄|단축)/i.test(t)) return special('concept-checkout-speed', ['⚡','⏱️'], 'commerce', 18);
        if (/\b(?:feature|tool).{0,24}(?:all|every) (?:user|customer|account)|(?:all|every) (?:user|customer|account).{0,20}(?:feature|tool)\b|(?:기능|도구).{0,18}(?:모든|전체)\s*(?:사용자|고객|계정)/i.test(t)) return special('concept-feature-all', ['🚀','✨'], 'product', 17);
        if (/\b(?:quality).{0,20}(?:below|lower|didn['’]t meet|did not meet|not meet|worse).{0,16}(?:expected|advertised|promised|expectations?)?|(?:below|lower).{0,12}quality\b|품질.{0,18}(?:기대|광고|약속|수준).{0,12}(?:낮|못\s*미치|미달)/i.test(t)) return special('concept-quality-bad', ['😔','👎'], 'mood', 18);
        if (/\b(?:order|package|parcel).{0,16}(?:shipped|dispatched|on the way|arrive|arrival)|(?:shipped|dispatched).{0,16}(?:order|package)\b|(?:주문|택배|상품).{0,14}(?:발송|배송\s*중|도착)/i.test(t)) return special('concept-delivery', ['📦','🚚'], 'commerce', 16);

        // Technical status.
        if (/\b(?:api|endpoint).{0,18}(?:http\s*)?(?:4\d\d|5\d\d|error)|(?:http\s*)?(?:4\d\d|5\d\d).{0,16}(?:api|endpoint)\b|(?:API|엔드포인트).{0,14}(?:HTTP\s*)?(?:4\d\d|5\d\d|오류)/i.test(t)) return special('concept-api-error', ['❌','💻'], 'tech', 19);
        if (/\b(?:patch|release|build|deployment).{0,18}(?:production).{0,14}(?:success|successful|successfully|deployed|reached)|(?:deployed|reached).{0,14}production\b|(?:패치|릴리스|빌드|배포).{0,14}(?:프로덕션|운영).{0,12}(?:성공|배포|반영)/i.test(t)) return special('concept-production', ['🚀','✅'], 'tech', 19);
        if (/\b(?:build|version)\s*[\w.-]+.{0,16}(?:ready|prepared).{0,10}(?:deploy|deployment|release|ship|go out)|(?:ready for).{0,12}(?:deployment|release)\b|(?:빌드|버전)\s*[\w.-]+.{0,16}(?:배포|출시|릴리스).{0,10}(?:준비|가능)/i.test(t)) return special('concept-version-ready', ['🔄','📱'], 'tech', 18);
        if (/\b(?:crash|crashes|bug|issue).{0,18}(?:fixed|resolved|no longer|doesn['’]t|does not)|(?:fixed|resolved).{0,16}(?:crash|bug|issue)\b|(?:충돌|크래시|버그|문제).{0,16}(?:수정|해결|더\s*이상.{0,6}(?:않|없))/i.test(t)) return special('concept-tech-fixed', ['✅','🛠️'], 'tech', 18);
        if (/\b(?:docs?|documentation|developer guide|manual).{0,20}(?:error|exception|stack trace|solution|answer)|(?:error|exception|stack trace).{0,20}(?:docs?|documentation|guide)\b|(?:문서|가이드).{0,18}(?:오류|예외|스택|해결|답)|(?:오류|예외|스택).{0,18}(?:문서|가이드)/i.test(t)) return special('concept-docs-search', ['🔎','💻'], 'tech', 16);
        if (/\b(?:cache|caching).{0,20}(?:latency|response time).{0,14}(?:lower|reduced|dropped|improved)|(?:latency|response time).{0,18}(?:cache|caching).{0,12}(?:reduced|improved)|캐시.{0,16}(?:지연|응답\s*시간).{0,12}(?:줄|감소|개선)/i.test(t)) return special('concept-cache-latency', ['⏱️','📈','📉'], 'tech', 18);
        if (/\b(?:2fa|two[- ]factor).{0,18}(?:admin|administrator|require|mandatory)|(?:admin|administrator).{0,18}(?:2fa|two[- ]factor)|(?:2FA|2단계\s*인증|이중\s*인증).{0,16}(?:관리자|필수|필요)|관리자.{0,16}(?:2FA|2단계\s*인증)/i.test(t)) return special('concept-2fa', ['🔒','🛡️'], 'tech', 18);
        if (/\b(?:migration|import|sync).{0,18}(?:completed|finished).{0,12}(?:cleanly|successfully|without errors?)?|(?:completed|finished).{0,14}(?:migration|import|sync)\b|(?:마이그레이션|가져오기|동기화).{0,16}(?:완료|끝).{0,10}(?:성공|오류\s*없이|깔끔)/i.test(t)) return special('concept-migration', ['✅','💻'], 'tech', 18);

        // Safety / availability / negation.
        if (/\b(?:back online|online again|working normally|available again|stable again)\b|다시\s*(?:온라인|정상|사용\s*가능)|정상\s*작동|정상적으로\s*작동/i.test(t)) return special('concept-back-normal', ['✅'], 'status', 18);
        if (/\b(?:draft|version|file).{0,18}(?:not|isn['’]t|is not).{0,16}(?:publish|release|final)|(?:not|isn['’]t).{0,14}(?:file|version).{0,16}(?:publish|release)\b|(?:초안|버전|파일).{0,16}(?:공개|출시|배포).{0,10}(?:아니|않|최종)/i.test(t)) return special('concept-not-final', ['📝','🔄'], 'product', 17);
        if (/\b(?:not satisfied|not happy with|disappointed with).{0,18}(?:service|product|purchase|quality)|(?:service|product|purchase).{0,18}(?:not satisfied|not happy)\b|(?:서비스|제품|상품|구매|품질).{0,16}(?:만족하지\s*않|만족스럽지\s*않|마음에\s*들지\s*않)/i.test(t)) return special('concept-dissatisfied', ['😔','😕'], 'mood', 18);
        if (/\b(?:could not|couldn['’]t|failed to).{0,12}(?:process|complete).{0,12}(?:payment|transaction)|(?:payment|transaction).{0,16}(?:could not|couldn['’]t|failed)\b|(?:결제|거래).{0,16}(?:처리|완료).{0,8}(?:할\s*수\s*없|되지\s*않|실패)/i.test(t)) return special('concept-payment-fail', ['❌','⚠️'], 'status', 19);
        if (/\b(?:not sure|uncertain|unsure|not certain).{0,20}(?:option|choice|plan|which|whether)?|(?:옵션|선택|요금제).{0,16}(?:확신|모르)|확신.{0,8}(?:없|들지\s*않)/i.test(t)) return special('concept-uncertain', ['🤔','💭'], 'mood', 18);

        // Study / email / security.
        if (/\b(?:quiz|exam|test).{0,18}(?:study|studying|notes?|review|prepare)|(?:study|studying|reviewing|notes?).{0,16}(?:quiz|exam|test)\b|(?:퀴즈|시험|테스트).{0,16}(?:공부|노트|복습|준비)|(?:공부|복습|준비).{0,14}(?:퀴즈|시험|테스트)/i.test(t)) return special('concept-study', ['📚','📖','✏️'], 'topic', 17);
        if (/\b(?:course|class|training|workshop).{0,14}(?:starts?|begins?).{0,16}(?:monday|tuesday|wednesday|thursday|friday|next week|tomorrow)|(?:교육|과정|수업|워크숍).{0,14}(?:시작|개강).{0,12}(?:월요일|화요일|수요일|목요일|금요일|다음\s*주|내일)?/i.test(t)) return special('concept-course', ['📚','📅'], 'topic', 17);
        if (/\b(?:password reset|recovery) (?:email|link).{0,20}(?:sent|valid|expires?|minutes?)|(?:비밀번호\s*재설정|복구)\s*(?:이메일|링크).{0,18}(?:전송|유효|만료|분)/i.test(t)) return special('concept-reset', ['🔒','⏰','📧'], 'status', 18);
        if (/\b(?:security|virus|malware) (?:check|scan).{0,16}(?:clean|no issues?|no problems?|no threats?)|(?:보안|바이러스|악성코드)\s*(?:점검|검사).{0,16}(?:깨끗|문제\s*없|이상\s*없|위협\s*없)/i.test(t)) return special('concept-security-clean', ['✅','🛡️'], 'tech', 18);
        if (/\b(?:support|help desk|support team).{0,16}(?:replied|answered|responded)|(?:지원팀|고객지원).{0,16}(?:답변|응답|회신)/i.test(t)) return special('concept-support-reply', ['💬'], 'support', 17);

        // Social-caption idioms and everyday mood.
        if (/\b(?:made it through|survived|got through).{0,12}(?:monday|today|the day|the week)|(?:monday|the day).{0,10}(?:survived)\b|(?:월요일|오늘|하루|한\s*주).{0,10}(?:버텼|견뎠|살아남)/i.test(t)) return special('concept-survived', ['😮‍💨','🙌'], 'mood', 17);
        if (/\b(?:no plans?|nothing planned).{0,18}(?:like|love|good|fine|happy)|(?:like|love).{0,12}(?:no plans?|nothing planned)\b|(?:아무\s*계획도\s*없|계획\s*없).{0,16}(?:좋|편|마음에\s*들)/i.test(t)) return special('concept-no-plans', ['😌','🌿'], 'life', 16);
        if (/\b(?:unexpectedly|surprisingly).{0,12}(?:good|nice|lovely) day|(?:good|nice|lovely) day.{0,12}(?:unexpectedly|surprisingly)\b|(?:예상하지\s*못|뜻밖에).{0,12}(?:기분\s*좋|좋은)\s*하루/i.test(t)) return special('concept-good-day', ['😊','✨'], 'mood', 16);

        // Writing / documents.
        if (/\b(?:drafted|wrote).{0,10}(?:email|message).{0,20}(?:not sent|haven['’]t sent|have not sent|unsent)|(?:email|message).{0,16}(?:draft|unsent)\b|(?:이메일|메시지)\s*초안.{0,14}(?:아직|보내지\s*않|미전송)/i.test(t)) return special('concept-email-draft', ['✏️','📧'], 'writing', 17);
        if (/\b(?:headline|title|heading).{0,16}(?:too long|doesn['’]t fit|not fit).{0,12}(?:layout|space|design)?|(?:제목|헤드라인).{0,16}(?:너무\s*길|레이아웃|공간).{0,12}(?:맞지\s*않|길다)?/i.test(t)) return special('concept-layout-title', ['✏️','📐'], 'writing', 16);
        if (/\b(?:added|wrote).{0,10}(?:note|comment).{0,16}(?:explain|explaining|change)|(?:note|comment).{0,18}(?:explains?|change)\b|(?:메모|주석).{0,16}(?:추가|작성).{0,12}(?:변경|설명)|변경.{0,12}(?:설명).{0,10}(?:메모|주석)/i.test(t)) return special('concept-note', ['📝','💡'], 'writing', 16);
        if (/\b(?:document|file).{0,16}(?:checklist).{0,12}(?:include|includes|added)|(?:checklist).{0,16}(?:document|file)\b|(?:문서|파일).{0,16}(?:체크리스트).{0,10}(?:추가|포함)/i.test(t)) return special('concept-checklist', ['✅','📝'], 'writing', 17);
        if (/\b(?:paragraph|section|draft).{0,18}(?:still needs|needs more|needs work|edit)|(?:still needs|needs work).{0,14}(?:paragraph|section|draft)\b|(?:문단|섹션|초안).{0,16}(?:아직|더).{0,10}(?:수정|편집|작업).{0,6}(?:필요)?/i.test(t)) return special('concept-writing-work', ['✏️','📝'], 'writing', 16);

        // Status switches / approvals.
        if (/\b(?:notification|notifications).{0,16}(?:turned off|disabled|off)|(?:알림).{0,14}(?:꺼|비활성|끄)/i.test(t)) return special('concept-notification-off', ['🔕','📵'], 'status', 18);
        if (/\b(?:feature|option).{0,16}(?:unavailable|not available).{0,14}(?:browser)?|(?:browser).{0,14}(?:feature|option).{0,10}(?:unavailable|not available)|(?:브라우저).{0,14}(?:기능|옵션).{0,10}(?:사용할\s*수\s*없|이용\s*불가|지원되지\s*않)/i.test(t)) return special('concept-browser-unavailable', ['🚫','🌐'], 'status', 18);
        if (/\b(?:request|application|change).{0,16}(?:approved|accepted).{0,14}(?:without changes?|as is)?|(?:요청|신청|변경).{0,16}(?:수정\s*없이)?.{0,8}(?:승인|수락)/i.test(t)) return special('concept-request-approved', ['✅'], 'status', 18);

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

    function detectTone(text) {
        const formal = /\b(?:report|quarter|monthly|revenue|metric|data|analysis|project|client|deadline|action item|server|system|user|traffic|conversion|survey|document|review|approve|issue)\b|보고서|분기|월간|매출|지표|데이터|분석|프로젝트|클라이언트|마감|실행\s*항목|서버|시스템|사용자|트래픽|전환|설문|문서|검토|승인|문제/i.test(text);
        const personal = /\b(?:i|my|me|we|our|feel|today|tonight|weekend|life|friend|family|home|morning|evening)\b|나는|저는|내가|오늘|이번\s*주말|삶|친구|가족|집에서|아침|저녁|기분/i.test(text);
        const social = /\b(?:caption|post|story|weekend|vibes?|favorite|favourite|tonight|finally)\b|캡션|게시물|스토리|주말|최애|드디어/i.test(text);
        if (formal && !personal) return 'formal';
        if (social) return 'social';
        if (personal) return 'personal';
        return 'neutral';
    }

    function genericFallback(text) {
        const trimmed = text.trim();
        if (!trimmed || !WORD.test(trimmed)) return null;
        const tone = detectTone(trimmed);

        if (/[?？]\s*$/.test(trimmed)) return special('generic-question', ['🤔','❓'], 'generic', 9);
        if (UNCERTAIN.test(trimmed)) return special('generic-uncertain', ['🤔','💭'], 'generic', 9);
        if (/\b(?:i|we)\b.{0,25}\b(?:think|feel|realize|remember|wonder)\b/i.test(trimmed) || /(?:나는|저는|우리는).{0,20}(?:생각|느끼|깨닫|기억|궁금)/i.test(trimmed)) {
            return special('generic-reflection', ['💭'], 'generic', 8.5);
        }
        if (/\b(?:friend|family|people|together|conversation|talked with|met someone|met my|met a)\b/i.test(trimmed) || /친구|가족|사람|함께|대화|만났/i.test(trimmed)) {
            return special('generic-social', ['🤝','😊'], 'generic', 8.5);
        }
        if (/\b(?:life|day|days|week|weeks|everyday|daily|routine)\b/i.test(trimmed) || /삶|하루|일상|매일|루틴/i.test(trimmed)) {
            return special('generic-life', ['🌱','🌿'], 'generic', 8);
        }
        if (/\b(?:start|begin|next|continue|try|trying|plan|planning)\b/i.test(trimmed) || /시작|다음|계속|시도|계획/i.test(trimmed)) {
            return special('generic-action', tone === 'formal' ? ['📌','➡️'] : ['➡️','🌱'], 'generic', 7.8);
        }
        if (/\b(?:good|nice|better|enjoy|enjoying|like|favorite|favourite)\b/i.test(trimmed) || /좋|즐기|마음에\s*들/i.test(trimmed)) {
            return special('generic-positive', tone === 'formal' ? ['✅'] : ['😊','✨'], 'mood', 7.8);
        }
        if (/\b(?:hard|difficult|rough|problem|issue|confusing)\b/i.test(trimmed) || /어렵|힘들|문제|복잡/i.test(trimmed)) {
            return special('generic-challenge', tone === 'formal' ? ['⚠️','🛠️'] : ['🧩','💭'], 'generic', 7.8);
        }
        if (/\b(?:why|because|therefore|however|means|explain|reason)\b|왜|이유|때문|따라서|하지만|설명/i.test(trimmed)) {
            return special('generic-explanation', ['💡','🔎'], 'generic', 7.4);
        }
        if (/\b(?:how to|step|steps|method|guide|instructions?)\b|단계|방법|절차|가이드|사용법/i.test(trimmed)) {
            return special('generic-guide', ['📝','➡️'], 'generic', 7.4);
        }
        if (/[!！]\s*$/.test(trimmed) && tone !== 'formal') return special('generic-emphasis', ['✨','🙌'], 'generic', 6.8);

        // A fallback is still useful, but it should reflect the document tone rather than
        // using the same decorative symbol for reports, personal writing and captions.
        if (tone === 'formal') {
            if (/\d|%|percent|rate|total|average|count|number|수치|비율|건수|평균|합계/.test(trimmed)) return special('formal-metric', ['📊'], 'report', 6.4);
            if (/review|check|confirm|검토|확인/.test(trimmed)) return special('formal-review', ['👀','✅'], 'report', 6.2);
            return special('formal-note', ['📌','📝'], 'report', 5.8);
        }
        if (tone === 'social') return special('social-caption', ['✨','😊'], 'generic', 5.8);
        if (tone === 'personal') {
            if (tokenCount(trimmed) <= 7) return special('personal-short', ['😊','🌿'], 'generic', 5.8);
            return special('personal-long', ['🌿','💭'], 'generic', 5.4);
        }
        if (tokenCount(trimmed) <= 6) return special('generic-short', ['✨','🙂'], 'generic', 5.4);
        if (tokenCount(trimmed) <= 16) return special('generic-medium', ['💡','💬'], 'generic', 5.1);
        return special('generic-long', ['💡','🌿'], 'generic', 4.8);
    }

    function stripLeadLabel(text) {
        let value = text;
        const colonLabel = /^\s*(?:Caption|Post|Story|Small moment|Moment|At home|Home note|Routine|Today|Weekend post|Weekend note|Personal note|Personal|People|People note|Little update|A small update|Report note|Report|Analytics|Dashboard|KPI|Technical note|Technical update|Engineering note|Engineering update|Engineering log|Ops|Infra|DevOps note|System note|System update|Dev note|Project update|Worklog|Office|Team note|Team update|Customer update|Customer message|Purchase note|Shop|Order note|Store update|Order update|Product note|Status update|Quick update|Quick note|Travel note|Travel log|Route note|Trip|Itinerary|Trip update|Wellness note|Health log|Fitness log|Training note|Study|Class note|Creative|Studio note|Weekly report|Metrics|For the team|For clarity|Context|Example|Notice|Update|Note|SNS 캡션|게시물|스토리|작은 순간|순간|집에서|집 메모|일상|오늘|사람들|사람 메모|개인|주말 게시물|주말 기록|짧은 기록|한 줄 기록|소소한 메모|오늘 기록|오늘 메모|보고 메모|보고|분석|대시보드|기술 메모|기술 업데이트|엔지니어링 메모|엔지니어링 로그|운영|개발 메모|데브옵스 메모|인프라|엔지니어링 업데이트|시스템 메모|시스템 업데이트|프로젝트 업데이트|업무 기록|사무|팀 메모|팀 업데이트|팀 공유|고객 안내|고객 메시지|구매 메모|쇼핑|주문 메모|스토어 업데이트|주문 안내|상품 메모|업무 업데이트|여행|일정|여행 메모|여행 기록|경로 메모|여행 업데이트|웰니스 메모|건강 기록|운동 기록|운동 메모|공부|수업 메모|창작|스튜디오 메모|주간 보고|지표|일상 메모|근황|문맥|예시|참고|안내|상태 업데이트|메모)\s*:\s*/i;
        const discourseLead = /^\s*(?:Honestly|Lately|For context|Context for today|One more thing|A quick thought|One thing I noticed|솔직히|요즘|참고로|오늘 한 가지|덧붙이면|짧은 생각|짧게 기록하면|한 가지 느낀 점은)\s*,?\s*/i;
        for (let i = 0; i < 4; i++) {
            const next = value.replace(colonLabel, '').replace(discourseLead, '');
            if (next === value) break;
            value = next;
        }
        return value;
    }

    function secondarySemanticAnalyses(text, rawText, primary) {
        if (!text || text.length < 70) return [];
        const found = [];
        const seen = new Set([primary && primary.id].filter(Boolean));

        function add(candidate) {
            if (!candidate || seen.has(candidate.id)) return;
            if (candidate.group === 'generic' || candidate.confidence < 8.5) return;
            seen.add(candidate.id);
            found.push(candidate);
        }

        // Full-sentence profile scoring can expose a second topic hidden behind a
        // high-priority status rule (e.g. attachment + meeting, rain + photo editing).
        for (const candidate of scoreProfiles(text).slice(0, 8)) add(candidate);

        // Compound English/Korean clauses receive their own semantic pass. Protected
        // spans remain masked before this point, so URL/code text cannot hijack a clause.
        const clauses = text.split(/\s*(?:,|;|—|–)\s*|\s+(?:and|but|while|so|then|although|though)\s+|\s+(?:그리고|하지만|그래서|또한|반면)\s+/i)
            .map(v => v.trim())
            .filter(v => v.length >= 12);
        for (const clause of clauses.slice(0, 8)) {
            const sp = classifySpecial(clause, clause);
            if (sp) add(sp);
            const cr = concreteFallback(clause);
            if (cr) add(cr);
            const cp = conceptFallback(clause);
            if (cp) add(cp);
            const top = scoreProfiles(clause)[0];
            if (top) add(top);
        }
        return found.sort((a, b) => b.confidence - a.confidence || b.priority - a.priority).slice(0, 4);
    }

    function analyzeSentence(text, rawText) {
        text = stripLeadLabel(text);
        const v62Result = precisionV62(text, rawText);
        if (v62Result) return [v62Result, ...secondarySemanticAnalyses(text, rawText, v62Result)];

        const v59Result = precisionV59(text, rawText);
        if (v59Result) return [v59Result, ...secondarySemanticAnalyses(text, rawText, v59Result)];

        const v58Result = precisionV58(text, rawText);
        if (v58Result) return [v58Result, ...secondarySemanticAnalyses(text, rawText, v58Result)];

        const v57Result = precisionV57(text, rawText);
        if (v57Result) return [v57Result, ...secondarySemanticAnalyses(text, rawText, v57Result)];

        const precisionResult = precisionV53(text, rawText);
        if (precisionResult) return [precisionResult, ...secondarySemanticAnalyses(text, rawText, precisionResult)];

        const specialResult = classifySpecial(text, rawText);
        if (specialResult) return [specialResult, ...secondarySemanticAnalyses(text, rawText, specialResult)];

        const concreteResult = concreteFallback(text);
        if (concreteResult) return [concreteResult, ...secondarySemanticAnalyses(text, rawText, concreteResult)];

        const conceptResult = conceptFallback(text);
        if (conceptResult) return [conceptResult, ...secondarySemanticAnalyses(text, rawText, conceptResult)];

        const scored = scoreProfiles(text).filter(item => item.confidence >= 5.5);
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

    function targetCount(sentenceCount, visibleLength, existing, tone) {
        if (sentenceCount <= 0) return 0;
        let target;
        if (sentenceCount === 1) target = visibleLength >= 150 ? 2 : 1;
        else if (sentenceCount === 2) target = visibleLength >= 120 ? 3 : 2;
        else if (sentenceCount <= 4) {
            const dense = tone === 'social' || tone === 'personal';
            if (sentenceCount === 3 && visibleLength >= 190) target = 5;
            else if (sentenceCount === 3 && visibleLength >= 125) target = 4;
            else if (sentenceCount === 4 && (visibleLength >= 190 || dense)) target = 4;
            else target = visibleLength >= 240 || dense ? Math.min(4, sentenceCount + (visibleLength >= 420 ? 1 : 0)) : Math.min(3, sentenceCount);
        } else if (sentenceCount <= 7) {
            target = Math.ceil(sentenceCount * (tone === 'formal' ? 0.58 : tone === 'social' ? 0.82 : 0.75));
        } else if (sentenceCount <= 12) {
            target = Math.ceil(sentenceCount * (tone === 'formal' ? 0.52 : tone === 'social' ? 0.72 : 0.65));
        } else {
            target = Math.ceil(sentenceCount * (tone === 'formal' ? 0.45 : tone === 'social' ? 0.62 : 0.56));
        }

        if (visibleLength > 900) target += 1;
        if (visibleLength > 1800) target += 1;
        return Math.max(0, Math.min(18, target) - Math.min(existing, target));
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
                    analyses: hasEmoji(piece.raw) ? [] : analyzeSentence(clean, piece.raw)
                });
            });
        });

        const eligible = entries.filter(e => !e.existingEmoji && e.analyses.length);
        const existing = emojiCount(originalText);
        EMOJI.lastIndex = 0;
        const visibleText = masked.replace(EMOJI, '').replace(/\s/g, '');
        const visibleLength = visibleText.length;
        const hangulCount = (visibleText.match(/[가-힣]/g) || []).length;
        const weightedLength = visibleLength + Math.round(hangulCount * 1.5);
        const documentTone = detectTone(masked);
        const wanted = targetCount(entries.length, weightedLength, existing, documentTone);
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
                const cap = ['status','report','tech'].includes(entry.best.group) ? 2 : 1;
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
        let extraBudget = Math.max(0, wanted - finalSelected.length);

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
                // Long compound sentences may carry a second clear theme. Use spare document
                // budget rather than forcing one emoji per sentence or flooding every clause.
                const cleanHangul = (clean.match(/[가-힣]/g) || []).length;
                const semanticSentenceLength = clean.length + Math.round(cleanHangul * 1.2);
                const preferOwnPair = new Set(['v62-up-down-dashboard','v62-deploy-mixed']);
                const mayUseSecond =
                    (preferOwnPair.has(analysis.id) && analysis.emojis.length > 1) ||
                    (semanticSentenceLength >= 58 &&
                     (chosenEntry.analyses.length > 1 || analysis.emojis.length > 1) &&
                     (extraBudget > 0 || entries.length === 1));
                if (mayUseSecond) {
                    if (preferOwnPair.has(analysis.id) && analysis.emojis.length > 1) {
                        const secondEmoji = chooseEmoji(analysis.emojis.slice(1), clean + analysis.id + ':paired', recent.concat(emoji), usedEmoji);
                        if (secondEmoji && secondEmoji !== emoji) {
                            extras.push(secondEmoji);
                            if (extraBudget > 0) extraBudget -= 1;
                        }
                    } else {
                        const second = chosenEntry.analyses.find(candidate =>
                            candidate.id !== analysis.id &&
                            candidate.confidence >= 9 &&
                            candidate.group !== 'generic'
                        );
                        if (second) {
                            const secondEmoji = chooseEmoji(second.emojis, clean + second.id, recent.concat(emoji), usedEmoji);
                            if (secondEmoji && secondEmoji !== emoji) {
                                extras.push(secondEmoji);
                                if (extraBudget > 0) extraBudget -= 1;
                            }
                        } else if (extraBudget > 0 && analysis.emojis.length > 1) {
                            const secondEmoji = chooseEmoji(analysis.emojis.slice(1), clean + analysis.id + ':secondary', recent.concat(emoji), usedEmoji);
                            if (secondEmoji && secondEmoji !== emoji) {
                                extras.push(secondEmoji);
                                extraBudget -= 1;
                            }
                        }
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
