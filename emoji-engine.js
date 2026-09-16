/* Mojitap local suggestion engine — version 2026-09-16.
 * No network requests. Conservative matching is intentional: an unchanged
 * sentence is preferable to a misleading decoration. This is not semantic AI.
 */
(function (root) {
    'use strict';

    const VERSION = '2026-09-16';
    const EMOJI = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;
    const PROTECTED = /```[\s\S]*?(?:```|(?![\s\S]))|~~~[\s\S]*?(?:~~~|(?![\s\S]))|`[^`\r\n]*`|!?\[[^\]\r\n]*\]\([^\r\n)]*\)|https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:^|\s)[#@][\p{L}\p{N}_][\p{L}\p{N}_.-]*|<[^>\r\n]+>/gimu;
    const SENSITIVE = /사망|별세|장례|부고|참사|희생자|유가족|자살|자해|극단적 선택|성폭력|성추행|전쟁|암 진단|암에 걸|호흡곤란|가슴 통증|의식.{0,6}없|\b(?:suicide|self[- ]harm|funeral|bereavement|war|rape|assault|overdose|chest pain)\b|passed away|rest in peace|\b(?:died|dead|death|fatalities)\b|cancer diagnosis|diagnosed with cancer|cannot breathe|can['’]t breathe/i;
    const IRONY_OR_UNCERTAIN = /\b(?:sarcasm|sarcastic|as if|yeah right|I guess|maybe|perhaps|might|not sure|could be)\b|아마|일지도|확실하지|비꼬|농담으로/i;
    const NO_WORDS = /[\p{L}\p{N}]/u;
    const EN_NEG = /\b(?:not|never|no|without|neither|nor|cannot|don['’]t|doesn['’]t|didn['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|won['’]t|wouldn['’]t|shouldn['’]t|couldn['’]t|can['’]t|hasn['’]t|haven['’]t)\b/i;
    const KO_NEG = /하지\s*마|지\s*(?:않|안|못)|아니|없(?:다|어|습|는|음)|안\s*(?:좋|되|하|맞|가|오|먹|열|추천|기쁘|행복)|못\s*(?:하|가|오|열|먹)|금지|비추천|실패|취소|연기|보류|거절|불가|잘못/i;
    const NEGATED_NEGATIVE = /(?:not|never|isn['’]t|wasn['’]t|hasn['’]t|haven['’]t)\s+(?:been\s+)?(?:cancelled|canceled|failed|delayed|broken|rejected|unsafe)|(?:취소|실패|지연|연기|오류|고장).{0,10}(?:아니|아닙|않|없)|실패하지/i;
    const STOP_ACTION = /\b(?:do not|don['’]t|never|must not|should not|shouldn['’]t)\s+(?:ever\s+)?(?:click|tap|open|follow|visit|sign\s*up|subscribe|download|install|buy|share|send)\b|(?:클릭|접속|열|가입|구독|다운로드|설치|구매|공유|전송).{0,14}(?:하지\s*마|지\s*마|금지|안\s*돼)|(?:클릭|접속|가입|구독|설치|구매|공유)\s*금지/i;
    const CANCEL = /\b(?:cancelled|canceled|cancelling|canceling|postponed|delayed|called off|on hold)\b|취소(?:됐|되|했|합|된|됨)|연기(?:됐|되|했|합|된|됨)|지연(?:됐|되|된|중)|보류(?:됐|되|된|중)/i;
    const BAD_OUTCOME = /\b(?:failed|failure|unsuccessful|rejected|declined|broken|crashed|outage)\b|could(?:n['’]t| not) (?:save|import|upload|connect)|(?:저장|결제|연결|업로드|가져오기).{0,10}(?:실패|안\s*돼|못)|실패(?:했|합|함|한)|오류.{0,5}(?:발생|났)|고장|장애\s*발생/i;
    const BAD_REVIEW = /(?:do not|don['’]t|wouldn['’]t|cannot|can['’]t)\s+recommend|would not recommend|waste of money|poor quality|bad experience|not worth|비추천|추천하지\s*않|돈이\s*아깝|품질.{0,8}(?:나쁘|나빠)|최악/i;
    const NEG_MOOD = /\b(?:not|isn['’]t|wasn['’]t)\s+(?:very\s+)?happy\b|\b(?:unhappy|disappointed|upset|frustrated)\b|기분.{0,8}좋지\s*않|행복하지\s*않|실망|속상|짜증|우울/i;
    const CTA = /\b(?:click|tap|visit) (?:the |this |our )?link\b|\bsign up\b|\bsubscribe\b|\bjoin us\b|\bshop now\b|\bshare (?:this|the|your)\b|\bbookmark (?:this|the)\b|\bfollow us\b|링크.{0,8}클릭|가입해|가입하세|구독해|구독하세|공유해|공유하세|저장해|저장하세/i;
    const HYPOTHETICAL = /^(?:\s*(?:[-*•]|\d+[.)])?\s*)(?:if\b|suppose\b|imagine\b|만약)|\b(?:if it|if the|if you|in case)\b|(?:하면|한다면|된다면|될 경우|가정하면)/i;
    const R = (id, re, emojis, rank, group) => ({ id, re, emojis, rank, group: group || 'topic' });
    const RULES = [
        R('warning', /\b(?:warning|caution|beware|phishing|scam|dangerous link|security alert)\b|경고|주의하|주의해|주의\s*사항|피싱|사기\s*문자|위험한\s*링크/i, ['⚠️'], 100, 'status'),
        R('payment-complete', /\bpayment (?:was |is |has been )?(?:approved|received|completed|successful)\b|결제.{0,6}(?:완료|승인)|입금.{0,6}확인/i, ['✅'], 98, 'status'),
        R('task-complete', /\b(?:saved successfully|upload complete|import complete|backup complete|report approved|task completed|project created|issue resolved)\b|\b(?:report|draft|file) (?:is |was |has been )?(?:approved|saved|ready)\b|저장.{0,5}완료|업로드.{0,5}완료|백업.{0,5}완료|초안.{0,5}완성|문제.{0,5}해결|프로젝트.{0,5}생성/i, ['✅'], 96, 'status'),
        R('delivery', /\b(?:package|parcel|shipment|delivery)\b|택배|배송|소포/i, ['📦'], 92),
        R('deadline', /\b(?:deadline|due (?:today|tomorrow|on)|submit by|expires? (?:today|tomorrow))\b|마감|제출\s*기한|제출하세|오늘까지|내일까지/i, ['⏰'], 90, 'status'),
        R('appointment', /\b(?:meeting|appointment|schedule|calendar|conference|webinar)\b|회의|약속|일정|세미나|웨비나/i, ['📅'], 85),
        R('apology', /\b(?:sorry|apologize|apologise|apology|apologies)\b|죄송|미안|사과드립니다/i, ['🙏'], 94, 'mood'),
        R('thanks', /\b(?:thank you|thanks|grateful|appreciate your|appreciate the)\b|감사|고마워|고맙|덕분/i, ['🙏','💛'], 88, 'mood'),
        R('birthday', /\b(?:birthday|happy anniversary)\b|생일|기념일/i, ['🎂','🎉'], 91, 'mood'),
        R('celebration', /\b(?:congratulations|congrats|graduated|graduation|we won|won the award)\b|축하|합격했|졸업했|우승했|수상했/i, ['🎉','🥳'], 90, 'mood'),
        R('launch', /\b(?:launched|launching|launch|now live|available now|released|release)\b|출시|정식\s*오픈|서비스\s*시작/i, ['🚀'], 76, 'event'),
        R('sale', /\b(?:discount|coupon|sale|giveaway|special offer|free shipping)\b|할인|쿠폰|증정|특가|무료\s*배송/i, ['🏷️','🎁'], 77),
        R('idea', /\b(?:idea|insight|tip|tips|suggestion)\b|아이디어|꿀팁|좋은\s*방법|힌트/i, ['💡'], 79),
        R('coffee', /\b(?:coffee|espresso|latte|cappuccino|cafe|café)\b|커피|아메리카노|라떼|카페/i, ['☕'], 84),
        R('tea', /\b(?:tea|matcha|green tea)\b|녹차|홍차|말차|차를\s*마/i, ['🍵'], 83),
        R('pizza', /\bpizza\b|피자/i, ['🍕'], 85),
        R('pasta', /\b(?:pasta|spaghetti)\b|파스타|스파게티/i, ['🍝'], 85),
        R('cake', /\b(?:cake|cupcake)\b|케이크/i, ['🍰'], 84),
        R('food', /\b(?:dinner|lunch|breakfast|meal|cooking|recipe|restaurant|brunch)\b|점심|저녁\s*식사|아침\s*식사|요리|맛집|식사|레시피/i, ['🍽️','🍴'], 73),
        R('dog', /\b(?:dog|puppy|puppies|beagle|retriever)\b|강아지|반려견/i, ['🐶','🐾'], 84),
        R('cat', /\b(?:cat|kitten|kittens)\b|고양이|반려묘/i, ['🐱','🐾'], 84),
        R('flight', /\b(?:flight|airport|airplane|boarding pass)\b|비행기|공항|항공편/i, ['✈️'], 86),
        R('travel', /\b(?:trip|travel|vacation|holiday|passport|suitcase)\b|여행|휴가|여권/i, ['🧳','🌍'], 73),
        R('hotel', /\b(?:hotel|hostel|resort)\b|호텔|숙소/i, ['🏨'], 84),
        R('rain', /\b(?:rain|raining|rainy|umbrella)\b|비가\s*오|장마|우산/i, ['🌧️','☔'], 84),
        R('snow', /\b(?:snow|snowing|snowy)\b|눈이\s*오|눈\s*오는|폭설/i, ['❄️'], 84),
        R('sunshine', /\b(?:sunny|sunshine)\b|햇살|화창/i, ['☀️'], 84),
        R('nature', /\b(?:forest|garden|park|hiking|nature|trail)\b|숲|정원|공원|등산|자연/i, ['🌿'], 71),
        R('ocean', /\b(?:beach|ocean|sea|surfing)\b|바다|해변|서핑/i, ['🌊'], 83),
        R('flowers', /\b(?:flowers?|blossoms?)\b|꽃|벚꽃/i, ['🌸'], 82),
        R('books', /\b(?:book|books|reading|library|novel)\b|독서|도서관|책을|책이|소설/i, ['📚'], 81),
        R('study', /\b(?:studying|study|homework|class|lesson|exam)\b|공부|수업|숙제|시험/i, ['📖','✏️'], 73),
        R('music', /\b(?:music|song|playlist|concert|singing)\b|음악|노래|콘서트|플레이리스트/i, ['🎵','🎧'], 81),
        R('photo', /\b(?:photo|photos|photography|camera)\b|사진|카메라|촬영/i, ['📷'], 80),
        R('art', /\b(?:painting|drawing|artwork|illustration)\b|그림|미술|일러스트/i, ['🎨'], 79),
        R('running', /\b(?:running|jogging|marathon)\b|러닝|달리기|마라톤/i, ['🏃'], 79),
        R('exercise', /\b(?:workout|exercise|fitness|gym)\b|운동|헬스/i, ['💪'], 73),
        R('football', /\b(?:football|soccer)\b|축구/i, ['⚽'], 80),
        R('basketball', /\bbasketball\b|농구/i, ['🏀'], 80),
        R('gaming', /\b(?:gaming|video game|gameplay|console|multiplayer)\b|게임|게이밍/i, ['🎮'], 79),
        R('code', /\b(?:coding|programming|javascript|python|developer|debugging)\b|코딩|프로그래밍|개발자|자바스크립트|파이썬/i, ['💻'], 78),
        R('data', /\b(?:spreadsheet|dataset|analytics|chart|statistics)\b|데이터|엑셀|통계|스프레드시트/i, ['📊'], 75),
        R('security', /\b(?:password|encryption|privacy|security|authentication)\b|비밀번호|암호|보안|개인정보/i, ['🔒'], 83),
        R('email', /\b(?:email|inbox|newsletter)\b|이메일|뉴스레터|받은편지함/i, ['✉️'], 65),
        R('attachment', /\b(?:attached|attachment)\b|첨부/i, ['📎'], 89),
        R('time', /\b(?:alarm|timer|wake up)\b|알람|타이머|기상/i, ['⏰'], 75),
        R('sleep', /\b(?:sleep|sleepy|bedtime|good night)\b|졸려|잠이|잘\s*자|취침/i, ['🌙'], 70),
        R('tired', /\b(?:tired|exhausted|burnout)\b|피곤|지쳤|번아웃/i, ['😮‍💨'], 80, 'mood'),
        R('joy', /\b(?:happy|delighted|excited|thrilled|glad)\b|행복|기쁘|기뻐|즐겁|신나|기분이\s*좋|기분\s*좋/i, ['😊','😃'], 64, 'mood'),
        R('anticipation', /\b(?:can['’]t wait|cannot wait|looking forward to)\b|기대돼|기대되|설레/i, ['🤩'], 89, 'mood'),
        R('affection', /\b(?:love you|miss you|love this)\b|사랑해|보고\s*싶|소중한/i, ['💛'], 76, 'mood'),
        R('humor', /\b(?:lol|hilarious|funny|joke)\b|ㅋㅋ|ㅎㅎ|웃겨|농담/i, ['😄'], 62, 'mood'),
        R('sad', /\b(?:sad|lonely|heartbroken|disappointed)\b|슬퍼|슬프|외로|속상|아쉽/i, ['💙'], 81, 'mood'),
        R('encouragement', /\b(?:you can do it|you['’]ve got this|keep going|good luck|don['’]t give up)\b|힘내|응원해|할\s*수\s*있어|포기하지\s*마/i, ['💪','🙌'], 87, 'mood'),
        R('gift', /\b(?:gift|present for|surprise for)\b|선물/i, ['🎁'], 78),
        R('shopping', /\b(?:shopping|shopping cart)\b|쇼핑|장바구니/i, ['🛒'], 71),
        R('home', /\b(?:new home|moving house|home renovation)\b|이사|새집|집들이/i, ['🏠'], 76),
        R('cleaning', /\b(?:cleaning|declutter|tidying)\b|청소|정리정돈/i, ['🧹'], 75),
        R('tools', /\b(?:repair|fixing|maintenance)\b|수리|정비/i, ['🛠️'], 70),
        R('payment', /\b(?:payment|invoice|budget|savings)\b|결제|청구서|예산|저축/i, ['💳'], 60)
    ];

    function hasEmoji(text) { EMOJI.lastIndex = 0; return EMOJI.test(text); }
    function emojiCount(text) { EMOJI.lastIndex = 0; return (text.match(EMOJI) || []).length; }
    function maskProtected(text) {
        PROTECTED.lastIndex = 0;
        return text.replace(PROTECTED, m => m.replace(/[^\r\n]/g, ' '));
    }
    function normalize(text) { return text.toLowerCase().replace(/[\s.!?。！？]+/g, ' ').trim(); }
    function rule(id, emoji, group) { return { id, emojis: [emoji], group: group || 'status', rank: 200 }; }
    function selectRules(text) {
        if (!NO_WORDS.test(text) || SENSITIVE.test(text) || IRONY_OR_UNCERTAIN.test(text) || HYPOTHETICAL.test(text)) return [];
        if (NEGATED_NEGATIVE.test(text)) return [];
        if (STOP_ACTION.test(text)) return [rule('prohibition', '⚠️')];
        if (BAD_REVIEW.test(text)) return [rule('negative-review', '👎', 'mood')];
        if (NEG_MOOD.test(text)) return [rule('negative-mood', '😕', 'mood')];
        if (CANCEL.test(text)) return [rule('cancelled', '⚠️')];
        if (BAD_OUTCOME.test(text)) return [rule('failed', '⚠️')];
        // Remove only well-understood positive idioms before looking for negation.
        const scope = text.replace(/\b(?:can['’]t wait|cannot wait|couldn['’]t be happier|not only|no wonder|no problem|don['’]t give up)\b/gi, ' ')
            .replace(/포기하지\s*마(?:세요)?/g, ' ');
        if (EN_NEG.test(scope) || KO_NEG.test(scope)) return [];
        if (CTA.test(text)) {
            if (/save|bookmark|저장/i.test(text)) return [rule('save', '🔖')];
            if (/link|링크/i.test(text)) return [rule('link', '🔗')];
            if (/sign up|join us|가입/i.test(text)) return [rule('signup', '📝')];
            if (/subscribe|구독/i.test(text)) return [rule('subscribe', '🔔')];
            return [rule('share', '📣')];
        }
        // Questions about facts are not confirmations of those facts.
        const question = /[?？]\s*$/.test(text);
        return RULES.filter(r => r.re.test(text) && !(question && (r.group === 'status' || r.group === 'event' || r.group === 'mood')))
            .sort((a,b) => b.rank-a.rank);
    }
    function sentenceSlices(raw, masked) {
        const result = []; let start = 0;
        for (let i=0; i<masked.length; i++) {
            if (!/[.!?。！？]/.test(masked[i])) continue;
            if (masked[i] === '.' && /[0-9]/.test(masked[i-1] || '') && /[0-9]/.test(masked[i+1] || '')) continue;
            if (masked[i] === '.' && /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|e\.g|i\.e)$/i.test(masked.slice(Math.max(0,i-10),i))) continue;
            let end=i+1;
            while (end<masked.length && /[.!?。！？"'”’\])]/.test(masked[end])) end++;
            if (end<masked.length && !/\s/.test(masked[end])) continue;
            // Keep an already appended emoji with its sentence on later passes.
            // Otherwise a period would split it away and invite another suggestion.
            let cursor=end;
            while (cursor<raw.length && /\s/.test(raw[cursor])) cursor++;
            let emojiEnd=end;
            while (cursor<raw.length) {
                EMOJI.lastIndex=0;
                const next=EMOJI.exec(raw.slice(cursor));
                if (!next || next.index!==0) break;
                cursor+=next[0].length;
                emojiEnd=cursor;
                while (cursor<raw.length && /\s/.test(raw[cursor])) cursor++;
            }
            end=emojiEnd;
            result.push({raw:raw.slice(start,end),clean:masked.slice(start,end)}); start=end; i=end-1;
        }
        if (start<raw.length) result.push({raw:raw.slice(start),clean:masked.slice(start)});
        return result;
    }
    function process(originalText) {
        if (typeof originalText !== 'string') throw new TypeError('Mojitap expects text.');
        const report={text:originalText,added:0,matchedSentences:0,version:VERSION};
        if (!originalText.trim()) return report;
        const masked=maskProtected(originalText);
        // Do not decorate a sensitive passage even when another sentence sounds upbeat.
        if (SENSITIVE.test(masked) || /\b(?:sarcasm|sarcastic)\b|비꼬는|반어법/i.test(masked)) return report;
        const rawLines=originalText.split(/(\r\n|\r|\n)/);
        const cleanLines=masked.split(/(\r\n|\r|\n)/);
        EMOJI.lastIndex = 0;
        const visibleLength=masked.replace(EMOJI,'').replace(/\s/g,'').length;
        const existing=emojiCount(originalText);
        // A ceiling, never a quota; most short sentences receive at most one emoji.
        const maxAdded=Math.max(0,Math.min(12,Math.max(1,Math.ceil(visibleLength/90)))-existing);
        if (!maxAdded) return report;
        const used=new Map(), seen=new Set();
        const paragraphExisting=new Map(); let paragraphIndex=0;
        rawLines.forEach((line,i) => {
            if (/^(?:\r\n|\r|\n)$/.test(line)) return;
            if (!line.trim()) { paragraphIndex++; return; }
            paragraphExisting.set(paragraphIndex,(paragraphExisting.get(paragraphIndex)||0)+emojiCount(line));
            for (const piece of sentenceSlices(line,cleanLines[i]||'')) {
                if (!hasEmoji(piece.raw)) continue;
                EMOJI.lastIndex=0;
                const clean=piece.clean.replace(EMOJI,'').trim();
                const choices=selectRules(clean);
                if (choices.length) used.set(choices[0].id,(used.get(choices[0].id)||0)+1);
                seen.add(normalize(clean));
            }
        });
        paragraphIndex=0;
        let paragraphAdded=paragraphExisting.get(0)||0; let lastEmoji='';
        const output=rawLines.map((line,i) => {
            if (/^(?:\r\n|\r|\n)$/.test(line)) return line;
            if (!line.trim()) { paragraphIndex++; paragraphAdded=paragraphExisting.get(paragraphIndex)||0; return line; }
            const cleaned=cleanLines[i] || '';
            // Preserve headings and code-like lines; don't insert into markdown syntax.
            if (/^\s*(?:#{1,6}\s|(?:const|let|var|import|export|function|class)\s|(?:\/\/|\/\*|\*\/))/.test(line)) return line;
            const pieces=sentenceSlices(line,cleaned);
            return pieces.map(piece => {
                const clean=piece.clean.trim();
                const key=normalize(clean);
                if (report.added>=maxAdded || paragraphAdded>=2 || !key || seen.has(key) || hasEmoji(piece.raw)) return piece.raw;
                const candidates=selectRules(clean);
                if (!candidates.length) return piece.raw;
                const choice=candidates[0];
                if ((used.get(choice.id)||0)>=3) return piece.raw;
                const emoji=choice.emojis.find(e=>e!==lastEmoji) || choice.emojis[0];
                const extras=[emoji];
                // Pair only two separate concrete topics in a long sentence; never status/mood pairs.
                const second=candidates.find(c=>c.id!==choice.id && c.group==='topic' && c.emojis[0]!==emoji);
                const distinctPair=choice.group==='topic' && clean.length>=160 && second &&
                    !(['food','coffee','tea','pizza','pasta','cake'].includes(choice.id) && ['food','coffee','tea','pizza','pasta','cake'].includes(second.id)) &&
                    !(['flight','travel','hotel'].includes(choice.id) && ['flight','travel','hotel'].includes(second.id));
                if (distinctPair && report.added+1<maxAdded && paragraphAdded<1 && (used.get(second.id)||0)<3) {
                    extras.push(second.emojis[0]); used.set(second.id,(used.get(second.id)||0)+1);
                }
                seen.add(key); used.set(choice.id,(used.get(choice.id)||0)+1);
                report.added+=extras.length; paragraphAdded+=extras.length; report.matchedSentences++;
                lastEmoji=extras[extras.length-1];
                const trailing=piece.raw.match(/\s*$/)[0];
                return piece.raw.slice(0,piece.raw.length-trailing.length)+' '+extras.join(' ')+trailing;
            }).join('');
        });
        report.text=output.join(''); return report;
    }
    const engine=Object.freeze({ version:VERSION, transform:text=>process(text).text, analyze:process });
    root.smartEmojiEngine=engine;
    if (typeof module==='object' && module.exports) module.exports=engine;
})(typeof globalThis!=='undefined'?globalThis:window);
