import { LanguageSwitch } from './LanguageSwitch';
import { t, useLanguage } from './i18n';
import { assignWordGroups, groupWords, recommendedGroup, studyGroups } from './groups';
import type { StudyGroup } from './groups';
import { GroupChoices } from './GroupChoices';
import {
  DEFAULT_AUDIO,
  answerSound,
  speakSwedish,
  stopSpeech,
  typingSound,
  unlockAudio,
} from './audio';
import type { AudioSettings } from './audio';
import { SoundSettings } from './SoundSettings';
import { HomeReview } from './HomeReview';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  BookOpen,
  Check,
  ChevronRight,
  Upload,
  FileText,
  X,
  Search,
  Star,
  Volume2,
  RefreshCw,
  Download,
  CheckCircle2,
  Leaf,
  LayoutGrid,
  Clock3,
  Settings2,
  FolderOpen,
  Keyboard,
  Eye,
  Pause,
  AlertCircle,
  Trash2,
  Pencil,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { DEMO, parseText, readFile, materialBlocks, readMaterial } from './parser';
import { AiOptions } from './AiOptions';
import { AiConnectionSettings, AiConnectionSummary } from './AiConnectionSettings';
import { useAiConnection } from './ai-connection';
import { TopicGenerator, defaultTopicOptions } from './TopicOptions';
import type { TopicOptions } from './TopicOptions';
import { AiEvidenceView } from './AiEvidenceView';
import { aiStatus, defaultOptions, requestAi } from './ai-client';
import type { AiStatus, ImportOptions } from './ai-client';
import type { SourceBlock } from '../shared/ai';
import {
  advanceSession,
  answerSession,
  createSession,
  emptyData,
  finishSession,
  hasPassed,
  normalize,
  spellingAnswer,
  uid,
  wordKey,
} from './model';
import type { Data, Deck, Draft, Session, Word } from './model';
import { download, loadData, saveData, validateData, StorageConflictError } from './storage';
import { mergeBackup } from './backup';

const dateLabel = () =>
  new Intl.DateTimeFormat('sv-SE', { month: 'long', day: 'numeric' }).format(new Date());

type Page = 'home' | 'library' | 'history' | 'settings';
function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">ORD. / YOUR OWN WORDS</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label={t('关闭')} onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
const speak = speakSwedish;
const SELECTED_DECK_KEY = 'ord-selected-deck';
function savedDeck(): string | null {
  try {
    return localStorage.getItem(SELECTED_DECK_KEY);
  } catch {
    return null;
  }
}
export default function App() {
  const language = useLanguage();
  const personalConnection = useAiConnection();
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(''),
    [saveError, setSaveError] = useState('');
  const [page, setPage] = useState<Page>('home'),
    [deckId, setDeckId] = useState<string | null>(savedDeck),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [importing, setImporting] = useState(false),
    [drafts, setDrafts] = useState<Draft[] | null>(null),
    [text, setText] = useState(''),
    [deckName, setDeckName] = useState(t('我的瑞典语笔记')),
    [pendingDeck, setPendingDeck] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [importError, setImportError] = useState('');
  const [importKind, setImportKind] = useState<'material' | 'topic'>('material');
  const [topicOptions, setTopicOptions] = useState(defaultTopicOptions);
  const [aiOptions, setAiOptions] = useState(defaultOptions);
  const [aiState, setAiState] = useState<AiStatus | null>(null);
  const [blocks, setBlocks] = useState<SourceBlock[] | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const abortAi = useRef<AbortController | null>(null);
  const importNameEdited = useRef(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState(''),
    [edit, setEdit] = useState<Word | null>(null),
    [picking, setPicking] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [pickerWords, setPickerWords] = useState<Word[]>([]),
    [pickerDeck, setPickerDeck] = useState<string | null>(null),
    [chosenGroup, setChosenGroup] = useState<string | null>(null),
    [manualPick, setManualPick] = useState(false),
    [reviewPicker, setReviewPicker] = useState(false),
    [reviewAll, setReviewAll] = useState(false),
    [training, setTraining] = useState(false),
    [intro, setIntro] = useState(false);
  const [draftFilter, setDraftFilter] = useState('all'),
    [draftSearch, setDraftSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null),
    backupRef = useRef<HTMLInputElement>(null),
    mergeBackupRef = useRef<HTMLInputElement>(null),
    spellRef = useRef<HTMLInputElement>(null);
  const loadFailed = useRef(false);
  const lastPlayedFeedback = useRef('');
  const speechErrorShown = useRef(false);
  const audioErrorShown = useRef(false);
  const audioSettings = { ...DEFAULT_AUDIO, ...data.audio };
  function reportAudioError(message: string) {
    if (!audioErrorShown.current) {
      audioErrorShown.current = true;
      setToast(message);
    }
  }
  useEffect(() => {
    if (!audioSettings.typingSound && !audioSettings.answerSound) return;
    const activate = () => unlockAudio();
    document.addEventListener('pointerdown', activate, true);
    document.addEventListener('keydown', activate, true);
    return () => {
      document.removeEventListener('pointerdown', activate, true);
      document.removeEventListener('keydown', activate, true);
    };
  }, [audioSettings.typingSound, audioSettings.answerSound]);
  function updateAudio(patch: Partial<AudioSettings>) {
    audioErrorShown.current = false;
    if (patch.autoPronounce === false) stopSpeech();
    unlockAudio();
    setData((old) => ({ ...old, audio: { ...DEFAULT_AUDIO, ...old.audio, ...patch } }));
  }
  useEffect(() => {
    if (!training) stopSpeech();
    return () => stopSpeech();
  }, [training]);
  useEffect(() => {
    let live = true;
    loadData()
      .then((d) => {
        if (live) {
          setData(d);
          setReady(true);
        }
      })
      .catch(() => {
        if (live) {
          loadFailed.current = true;
          setLoadError(t('本机数据暂时无法读取。为保护已有记录，请刷新重试，或用备份恢复。'));
          setReady(true);
        }
      });
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready && !loadFailed.current) {
      saveData(data)
        .then(() => setSaveError(''))
        .catch((error: unknown) =>
          setSaveError(
            error instanceof StorageConflictError
              ? error.message
              : t('保存失败：请先导出备份，并检查浏览器存储空间。'),
          ),
        );
    }
  }, [data, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const s = data.session;
  useEffect(() => {
    if (training && s && !s.finished && s.tasks[s.position]?.type === 'spell' && !s.feedback)
      spellRef.current?.focus();
  }, [training, s?.position, s?.turn, s?.feedback]);
  useEffect(() => {
    if (!ready || loadFailed.current) return;
    if (deckId && !data.decks.some((d) => d.id === deckId)) {
      setDeckId(null);
      return;
    }
    try {
      if (deckId) localStorage.setItem(SELECTED_DECK_KEY, deckId);
      else localStorage.removeItem(SELECTED_DECK_KEY);
    } catch {
      // The in-memory selection still works when browser storage is unavailable.
    }
  }, [ready, deckId, data.decks]);
  const currentDeck = data.decks.find((d) => d.id === deckId);
  const due = data.words.filter(
    (w) => (!deckId || w.deckId === deckId) && w.due !== null && w.due <= Date.now(),
  );
  const learnedForReview = data.words.filter(
    (w) => (!deckId || w.deckId === deckId) && (hasPassed(w) || w.sessions > 0),
  );
  const active = !!s && !s.finished;
  const today = new Date().toLocaleDateString();
  const todayCount = data.history
    .filter((h) => new Date(h.date).toLocaleDateString() === today)
    .reduce((a, h) => a + h.words, 0);
  const allPool = data.words.filter(
    (w) =>
      (!deckId || w.deckId === deckId) &&
      (!search ||
        `${w.term} ${w.meaning} ${w.note}`.toLowerCase().includes(search.toLowerCase())) &&
      (filter === 'favorite'
        ? w.favorite
        : filter === 'due'
          ? w.due !== null && w.due <= Date.now()
          : filter === 'new'
            ? !hasPassed(w)
            : true),
  );
  function navigate(p: Page) {
    setPage(p);
    setSearch('');
    setFilter('all');
  }
  useEffect(() => {
    refreshAiStatus();
  }, [personalConnection]);
  function refreshAiStatus() {
    aiStatus()
      .then(setAiState)
      .catch(() => setAiState(null));
  }
  useEffect(() => {
    if (!importing) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') refreshAiStatus();
    };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [importing]);
  function openImport(example = false, d?: Deck, kind: 'material' | 'topic' = 'material') {
    setImportKind(kind);
    setTopicOptions(defaultTopicOptions());
    importNameEdited.current = false;
    setAiOptions({ ...defaultOptions(), engine: example ? 'local' : 'ai' });
    setBlocks(null);
    setAiSummary(example ? t('本机示例预览，未调用 AI。') : '');
    refreshAiStatus();
    setPendingDeck(d?.id || null);
    setDeckName(d?.name || (kind === 'topic' ? t('主题词表 · SFI B') : t('我的瑞典语笔记')));
    setText(example ? DEMO : '');
    setDrafts(d ? structuredClone(d.pending) : example ? parseText(DEMO, t('示例笔记')) : null);
    setImportError('');
    setDraftFilter('all');
    setDraftSearch('');
    setImporting(true);
  }
  function closeImport() {
    if (busy) return;
    if (drafts?.length && !window.confirm(t('关闭整理窗口？这次尚未确认的修改不会保存。'))) return;
    setImporting(false);
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setImportError('');
    setAiSummary('');
    try {
      if (aiOptions.engine === 'ai') {
        const raw = await readMaterial(file);
        setBlocks(raw);
        setText(raw.map((b) => b.text).join('\n\n'));
      } else {
        const rows = await readFile(file);
        if (!rows.length) throw new Error(t('没有读到内容，请检查文件。'));
        if (rows.length > 2000) throw new Error(t('每次最多整理 2000 条，请拆分文件后再试。'));
        setDrafts(rows);
      }
      if (!importNameEdited.current && !pendingDeck)
        setDeckName(file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('无法读取文件，请尝试粘贴文本。'));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }
  function changeTopic(patch: Partial<TopicOptions>) {
    const next = { ...topicOptions, ...patch };
    setTopicOptions(next);
    setImportError('');
    if (!importNameEdited.current)
      setDeckName(`${next.topic.trim() || t('主题词表')} · SFI ${next.sfiLevel}`.slice(0, 100));
  }
  async function generateTopic() {
    if (!topicOptions.topic.trim()) return;
    if (!aiState?.configured) {
      setImportError(t('请先在 AI 设置中保存 API Key。'));
      setAiSettingsOpen(true);
      return;
    }
    const controller = new AbortController();
    abortAi.current = controller;
    setBusy(true);
    setImportError('');
    setAiSummary('');
    try {
      const result = await requestAi(
        { ...topicOptions, topic: topicOptions.topic.trim(), consent: true },
        controller.signal,
      );
      setDrafts(result.drafts);
      setAiSummary(result.summary);
      setDraftFilter('all');
      setDraftSearch('');
    } catch (error) {
      setImportError(
        controller.signal.aborted
          ? t('已取消生成，主题和课程设置仍保留。')
          : error instanceof Error
            ? error.message
            : t('生成失败，请重试。'),
      );
    } finally {
      abortAi.current = null;
      setBusy(false);
    }
  }
  async function parse() {
    if (!text.trim()) {
      setImportError(t('先粘贴一些学习材料。'));
      return;
    }
    setImportError('');
    setAiSummary('');
    if (aiOptions.engine === 'local') {
      try {
        const rows = parseText(text);
        if (rows.length > 2000) throw new Error(t('每次最多整理 2000 条，请分批导入。'));
        setDrafts(rows);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : t('无法整理这段文本。'));
      }
      return;
    }
    if (!aiState?.configured) {
      setImportError(t('请先在 AI 设置中保存 API Key。'));
      setAiSettingsOpen(true);
      return;
    }
    const controller = new AbortController();
    abortAi.current = controller;
    setBusy(true);
    try {
      const result = await requestAi(
        {
          blocks: blocks || materialBlocks(text),
          mode: aiOptions.mode,
          level: aiOptions.level,
          count: aiOptions.count,
          knownTerms:
            aiOptions.skipKnown && aiOptions.mode !== 'vocabulary' && aiOptions.mode !== 'mixed'
              ? data.words
                  .filter((w) => w.sessions > 0)
                  .slice(0, 2000)
                  .map((w) => w.term)
              : [],
          consent: true,
        },
        controller.signal,
      );
      setDrafts(result.drafts);
      const types: Record<string, string> = {
        vocabulary: t('词汇合集'),
        article: t('课文文章'),
        mixed: t('混合笔记'),
      };
      setAiSummary(
        t(
          'AI 识别：{0}。{1}{2}',
          types[result.detectedMode] || result.detectedMode,
          result.summary,
          result.skippedKnown ? t(' 已排除 {0} 个已练词。', result.skippedKnown) : '',
        ),
      );
    } catch (error) {
      setImportError(
        controller.signal.aborted
          ? t('已取消 AI 整理，材料仍保留。')
          : error instanceof Error
            ? error.message
            : t('AI 整理失败，材料仍保留。'),
      );
    } finally {
      abortAi.current = null;
      setBusy(false);
    }
  }
  function changeDraft(id: string, patch: Partial<Draft>) {
    setDrafts(
      (old) =>
        old?.map((d) => {
          if (d.id !== id) return d;
          const n = { ...d, ...patch };
          if (patch.meaning !== undefined && n.ai) n.ai = { ...n.ai, meaningOrigin: 'edited' };
          n.issue = !n.term.trim()
            ? t('缺少瑞典语词条')
            : !n.meaning.trim()
              ? t('缺少释义，请补充')
              : /[\u3400-\u9fff]/.test(n.term)
                ? t('请检查词条与释义是否颠倒')
                : /[.!?]$/.test(n.term)
                  ? t('可能是句子，请确认是否练习')
                  : '';
          return n;
        }) || null,
    );
  }
  async function commitImport() {
    if (busy || !drafts || !deckName.trim()) return;
    const id = pendingDeck || uid(),
      existing = new Map(
        data.words.filter((w) => w.deckId === id).map((w) => [wordKey(w), { ...w }]),
      );
    let duplicates = 0;
    const words: Word[] = [];
    const pending: Draft[] = [];
    for (const d of drafts) {
      if (!d.selected || !d.term.trim() || !d.meaning.trim()) {
        pending.push({ ...d, selected: false });
        continue;
      }
      const key = wordKey(d);
      const duplicate = existing.get(key);
      if (duplicate) {
        const note = [...new Set([duplicate.note, d.note].filter(Boolean))].join(' · ');
        const source = [...new Set([duplicate.source, d.source].filter(Boolean))].join('\n');
        const location = [...new Set([duplicate.location, d.location].filter(Boolean))].join(' / ');
        if (Math.max(note.length, source.length, location.length) > 20000) {
          pending.push({ ...d, selected: false, issue: t('重复词条内容过长，请手动合并') });
          continue;
        }
        Object.assign(duplicate, { note, source, location, ai: duplicate.ai || d.ai });
        duplicates++;
        continue;
      }
      const word: Word = {
        id: uid(),
        deckId: id,
        ai: d.ai,
        term: d.term.trim(),
        meaning: d.meaning.trim(),
        note: d.note,
        source: d.source,
        location: d.location,
        favorite: false,
        due: null,
        interval: 0,
        sessions: 0,
      };
      existing.set(key, word);
      words.push(word);
    }
    const nextData: Data = {
      ...data,
      words: assignWordGroups([
        ...data.words.map((w) => (w.deckId === id ? existing.get(wordKey(w)) || w : w)),
        ...words,
      ]),
      decks: pendingDeck
        ? data.decks.map((d) => (d.id === id ? { ...d, name: deckName.trim(), pending } : d))
        : [...data.decks, { id, name: deckName.trim(), created: Date.now(), pending }],
    };
    setBusy(true);
    try {
      await saveData(nextData);
      setData(nextData);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : t('保存失败：请先导出备份，并检查浏览器存储空间。'),
      );
      return;
    } finally {
      setBusy(false);
    }
    setImporting(false);
    setDrafts(null);
    setPage('library');
    setDeckId(id);
    setFilter('all');
    setSearch('');
    setToast(
      t(
        '{0}，加入 {1} 个词{2}{3}。',
        pendingDeck ? t('已更新词库') : t('已新建词库「{0}」，原有词库已保留', deckName.trim()),
        words.length,
        pending.length ? t('，{0} 条留在待整理', pending.length) : '',
        duplicates ? t('，合并 {0} 条重复内容并保留备注', duplicates) : '',
      ),
    );
  }
  const allGroups = studyGroups(data.words, data.decks);
  const homeNextGroup = recommendedGroup(allGroups.filter((g) => !deckId || g.deckId === deckId));
  const pickerDecks = data.decks.filter((d) => pickerWords.some((w) => w.deckId === d.id));
  const visiblePickerWords = pickerWords.filter((w) => w.deckId === pickerDeck);
  const pickerGroups = studyGroups(visiblePickerWords, data.decks);
  function selectPickerDeck(id: string) {
    const groups = studyGroups(
      pickerWords.filter((w) => w.deckId === id),
      data.decks,
    );
    const group = reviewAll ? groups[0] : recommendedGroup(groups, reviewPicker);
    setPickerDeck(id);
    setChosenGroup(group?.key || null);
    setSelected(
      group ? (reviewAll ? group.words : groupWords(group, reviewPicker)).map((w) => w.id) : [],
    );
  }
  function chooseGroup(group: StudyGroup, review = reviewPicker) {
    setChosenGroup(group.key);
    setSelected((reviewAll ? group.words : groupWords(group, review)).map((w) => w.id));
  }
  function openPicker(words: Word[], review = filter === 'due', allReview = false) {
    if (active) {
      unlockAudio();
      setTraining(true);
      setIntro(false);
      return;
    }
    if (!words.length) {
      setToast(t('还没有可练习的词，先导入一份笔记吧。'));
      return;
    }
    const pool = assignWordGroups(words);
    const groups = studyGroups(pool, data.decks);
    const group = allReview ? groups[0] : recommendedGroup(groups, review);
    setPickerDeck(group?.deckId || groups[0]?.deckId || null);
    setPickerWords(pool);
    setReviewPicker(review);
    setReviewAll(allReview);
    setManualPick(false);
    setChosenGroup(group?.key || null);
    setSelected(
      group ? (allReview ? group.words : groupWords(group, review)).map((w) => w.id) : [],
    );
    setPicking(true);
  }
  function begin() {
    const words = data.words.filter((w) => selected.includes(w.id));
    if (!words.length) return;
    unlockAudio();
    stopSpeech();
    speechErrorShown.current = false;
    audioErrorShown.current = false;
    const next = createSession(words, data.words);
    setData((old) => ({ ...old, session: next }));
    setPicking(false);
    setTraining(true);
    setIntro(true);
  }
  function updateSession(next: Session) {
    const eventKey = `${next.id}:${next.turn ?? next.position}`;
    if (next.feedback && s && !s.feedback && lastPlayedFeedback.current !== eventKey) {
      lastPlayedFeedback.current = eventKey;
      const task = next.tasks[next.position],
        word = data.words.find((w) => w.id === task.wordId);
      const assessed = task.type === 'spell' || !!task.options?.length;
      if (assessed && audioSettings.answerSound)
        answerSound(next.feedback.correct, reportAudioError);
      if (next.feedback.correct && audioSettings.autoPronounce && word)
        speak(word.term, (msg) => {
          if (!speechErrorShown.current) {
            speechErrorShown.current = true;
            setToast(msg);
          }
        });
    }
    setData((old) => (next.finished ? finishSession(old, next) : { ...old, session: next }));
  }
  function answer(value: string) {
    if (!s || s.finished || s.feedback) return;
    const word = data.words.find((w) => w.id === s.tasks[s.position].wordId)!;
    updateSession(answerSession(s, word, value));
  }
  function next() {
    if (!s) return;
    stopSpeech();
    updateSession(advanceSession(s));
  }
  function exportBackup() {
    download(
      `ord-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
    );
    setToast(t('完整备份已导出，包含词库、待整理内容与练习进度。'));
  }
  function exportCsv() {
    const words = deckId ? data.words.filter((w) => w.deckId === deckId) : data.words;
    const escape = (v: string) => `"${(/^[=+@-]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`;
    download(
      'ord-vocabulary.csv',
      '\uFEFF' +
        [
          [t('瑞典语'), t('中文'), t('词形与备注')],
          ...words.map((w) => [w.term, w.meaning, w.note]),
        ]
          .map((row) => row.map(escape).join(','))
          .join('\r\n'),
      'text/csv;charset=utf-8',
    );
  }
  async function restore(e: ChangeEvent<HTMLInputElement>, merge = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error(t('备份文件超过 25 MB。'));
      const restored = validateData(JSON.parse(await file.text()));
      if (merge) {
        const merged = mergeBackup(data, restored);
        await saveData(merged);
        setData(merged);
        setDeckId(null);
        setPage('library');
        setSearch('');
        setFilter('all');
        setToast(
          t(
            '备份已合并，新增 {0} 个词库；原有词库和进度已保留。',
            merged.decks.length - data.decks.length,
          ),
        );
        return;
      }
      if (
        !window.confirm(
          t(
            '恢复 {0} 个词库、{1} 个词？这会替换本机当前记录，建议先导出备份。',
            restored.decks.length,
            restored.words.length,
          ),
        )
      )
        return;
      await saveData(restored);
      loadFailed.current = false;
      setLoadError('');
      setData(restored);
      setTraining(false);
      setDeckId(null);
      setToast(t('备份已恢复。'));
    } catch (error) {
      setToast(
        error instanceof StorageConflictError
          ? error.message
          : t('恢复失败：请使用这个工具导出的完整 JSON 备份，原有数据未改变。'),
      );
    } finally {
      e.target.value = '';
    }
  }
  function demoDeck() {
    const existing = data.decks.find((d) => d.name === t('生活里的瑞典语'));
    if (existing) {
      setDeckId(existing.id);
      setPage('library');
      return;
    }
    const id = uid();
    const words = parseText(DEMO)
      .filter((d) => d.selected && d.meaning)
      .map((d) => ({
        id: uid(),
        deckId: id,
        term: d.term,
        meaning: d.meaning,
        note: d.note,
        source: d.source,
        location: t('合成示例'),
        favorite: false,
        due: null,
        interval: 0,
        sessions: 0,
      }));
    setData((old) => ({
      ...old,
      decks: [...old.decks, { id, name: t('生活里的瑞典语'), created: Date.now(), pending: [] }],
      words: assignWordGroups([...old.words, ...words]),
    }));
    setPage('library');
    setDeckId(id);
    setToast(t('示例词库已加入，选 10 个词试试吧。'));
  }
  if (!ready)
    return (
      <div className="loading">
        <span className="brand">
          ord<span>.</span>
        </span>
        <p>{t('打开你的练习本…')}</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
        >
          ord<span>.</span>
        </a>
        <p className="brand-caption">{t('一点一点，记住瑞典语。')}</p>
        <nav aria-label={t('主导航')}>
          {(
            [
              { id: 'home', label: t('今日练习'), icon: LayoutGrid },
              { id: 'library', label: t('我的词库'), icon: BookOpen },
              { id: 'history', label: t('学习记录'), icon: Clock3 },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={page === n.id ? 'nav active' : 'nav'}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'library' && (
                <span className="nav-count">{data.decks.length.toString().padStart(2, '0')}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="leaf-mark">
            <Leaf size={23} />
          </div>
          <span className="eyebrow">LITE VARJE DAG</span>
          <p>
            {t('每天一点点，')}
            <br />
            {t('让新词变成老朋友。')}
          </p>
          <span className="small-rule" />
        </div>
        <div className="sidebar-bottom">
          <button
            className={page === 'settings' ? 'nav active' : 'nav'}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={18} />
            {t('数据与设置')}
          </button>
          <div className="local-status">
            <span />
            {t('本机保存 · 试用版')}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            {t('我的瑞典语 ')}
            <span>/</span>{' '}
            {
              {
                home: t('今日练习'),
                library: t('我的词库'),
                history: t('学习记录'),
                settings: t('数据与设置'),
              }[page]
            }
          </div>
          <div className="top-date">
            <LanguageSwitch />
            {new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'zh-CN', {
              weekday: 'long',
            }).format(new Date())}
            <span>·</span>
            {dateLabel()}
            <span className="avatar">L</span>
          </div>
        </header>
        {(loadError || saveError) && (
          <div role="alert" className="error-banner">
            <AlertCircle size={18} />
            {loadError || saveError}
            <button className="text-button" onClick={exportBackup}>
              {t('导出当前备份')}
            </button>
          </div>
        )}
        {!loadError && (
          <>
            {page === 'home' && (
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <div className="eyebrow">
                      <span className="tiny-star">✳</span> DINA ORD. DIN TAKT.
                    </div>
                    <h1>
                      {t('把你的笔记，')}
                      <br />
                      {t('练成')}
                      <span className="serif-green">{t('记忆。')}</span>
                    </h1>
                    <p>
                      {t('课堂笔记、单词合集，或一篇正在读的课文。')}
                      <br />
                      {t('整理全部生词，或挑出适合你的重点词。')}
                    </p>
                    <div className="hero-actions">
                      <button
                        className="button primary"
                        onClick={() =>
                          active
                            ? (setTraining(true), setIntro(false))
                            : homeNextGroup
                              ? openPicker(
                                  data.words.filter((w) => w.deckId === homeNextGroup.deckId),
                                  false,
                                )
                              : data.words.length
                                ? navigate('library')
                                : openImport()
                        }
                      >
                        {active
                          ? t('继续上次练习')
                          : homeNextGroup
                            ? t('学习第 {0} 组', homeNextGroup.number)
                            : data.words.length
                              ? t('查看我的词库')
                              : t('导入我的单词')}
                        {active ? <ArrowRight size={18} /> : <Plus size={19} />}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => openImport(false, undefined, 'topic')}
                      >
                        {t('按主题生成词表')}
                      </button>
                      <button className="text-button" onClick={() => openImport(true)}>
                        {t('试试示例笔记 ')}
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="hero-footnote">
                      <ShieldCheck size={14} />
                      {t('文件在本机读取 · AI 整理前由你确认发送')}
                    </div>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-orbit orbit-one" />
                    <div className="art-orbit orbit-two" />
                    <span className="art-label">ETT ORD I TAGET</span>
                    <div className="floating-tag">
                      {t('每天，记住一点新东西 ')}
                      <Leaf size={13} />
                    </div>
                    <div className="word-paper">
                      <div className="paper-top">
                        <span>01 / 10</span>
                        <span>{t('sv → 中文')}</span>
                      </div>
                      <span className="paper-pronounce">[ ˈlɑ̂ːɡɔm ]</span>
                      <div className="paper-word">
                        lagom<span>.</span>
                      </div>
                      <div className="paper-line" />
                      <div className="paper-meaning">{t('不多不少，恰到好处')}</div>
                      <p>{t('学习也可以，刚刚好。')}</p>
                      <div className="paper-footer">
                        <span>{t('adverb · 副词')}</span>
                        <span className="paper-speaker">
                          <Volume2 size={18} />
                        </span>
                      </div>
                    </div>
                    <div className="art-spark spark-one">✳</div>
                    <div className="art-spark spark-two">+</div>
                    <span className="art-bottom">SMÅ STEG, STORA FRAMSTEG.</span>
                  </div>
                </section>
                <section className="stats-strip" aria-label={t('学习概况')}>
                  <div>
                    <span className="stat-icon">
                      <BookOpen size={19} />
                    </span>
                    <div>
                      <strong>
                        {data.words.length}
                        <small>{t('个词')}</small>
                      </strong>
                      <p>{t('我的词库')}</p>
                    </div>
                  </div>
                  <div>
                    <span className="stat-icon">
                      <RefreshCw size={19} />
                    </span>
                    <div>
                      <strong>
                        {due.length}
                        <small>{t('个词')}</small>
                      </strong>
                      <p>{t('今天待复习')}</p>
                    </div>
                  </div>
                  <div>
                    <span className="stat-icon">
                      <CheckCircle2 size={19} />
                    </span>
                    <div>
                      <strong>
                        {todayCount}
                        <small>{t('个词')}</small>
                      </strong>
                      <p>{t('今日已练习')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      document
                        .getElementById('home-review-title')
                        ?.scrollIntoView({ block: 'center' })
                    }
                  >
                    {t('前往复习 ')}
                    <ArrowRight size={18} />
                  </button>
                </section>
                <HomeReview
                  deckName={currentDeck?.name || t('全部词库')}
                  due={due.length}
                  learned={learnedForReview.length}
                  active={active}
                  onDue={() => openPicker(due, true)}
                  onLearned={() => openPicker(learnedForReview, false, true)}
                  onResume={() => {
                    setTraining(true);
                    setIntro(false);
                  }}
                />
                <section className="deck-section">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">YOUR COLLECTION</span>
                      <h2>
                        {t('从自己的单词开始')}
                        <span className="count-badge">{data.decks.length}</span>
                      </h2>
                    </div>
                    <button className="text-button" onClick={() => navigate('library')}>
                      {t('全部词库 ')}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="deck-grid">
                    {data.decks.slice(0, 2).map((d, i) => (
                      <DeckCard
                        key={d.id}
                        deck={d}
                        words={data.words.filter((w) => w.deckId === d.id)}
                        index={i}
                        onOpen={() => {
                          setDeckId(d.id);
                          setPage('library');
                        }}
                      />
                    ))}
                    {!data.decks.length && (
                      <button className="demo-deck" onClick={demoDeck}>
                        <div className="deck-icon">
                          <Leaf size={24} />
                        </div>
                        <span className="tag">{t('先体验一下')}</span>
                        <h3>{t('生活里的瑞典语')}</h3>
                        <p>{t('从 fika 到 lagom，认识日常里的小美好。')}</p>
                        <div className="deck-footer">
                          <span>{t('12 个词 · 示例词库')}</span>
                          <span className="circle-arrow">
                            <ArrowUpRight size={19} />
                          </span>
                        </div>
                      </button>
                    )}
                    <button className="add-deck" onClick={() => openImport()}>
                      <span className="add-circle">
                        <Plus size={25} />
                      </span>
                      <h3>{t('让笔记变成练习')}</h3>
                      <p>{t('上传文件，或直接粘贴你的单词')}</p>
                      <span className="file-formats">WORD · EXCEL · PDF · TEXT</span>
                    </button>
                  </div>
                </section>
                <div className="bottom-note">
                  <span>
                    ord <i>{t('〔瑞典语〕')}</i>
                    {t(' 名词，意为「单词」。')}
                  </span>
                  <span>
                    {t('自己的单词，自己的节奏。')}
                    <Leaf size={13} />
                  </span>
                </div>
              </>
            )}
            {page === 'library' && (
              <section className="page-section">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">WORDS WORTH KEEPING</span>
                    <h1>{currentDeck?.name || t('我的词库')}</h1>
                    <p>
                      {currentDeck
                        ? t('选几个今天想记住的词，开始一轮练习。')
                        : t('把每一次遇到的新词，收进自己的练习本。')}
                    </p>
                  </div>
                  <div className="button-group library-create-actions">
                    <button
                      className="button secondary"
                      onClick={() => openImport(false, undefined, 'topic')}
                    >
                      {t('按主题生成词表')}
                    </button>
                    <button className="button primary" onClick={() => openImport()}>
                      <Plus size={18} />
                      {t('导入单词')}
                    </button>{' '}
                  </div>
                </div>
                {data.words.some(
                  (w) =>
                    (!deckId || w.deckId === deckId) && w.sessions > 0 && w.passed === undefined,
                ) && (
                  <p className="notice" aria-label={t('旧版过关记录待核验')}>
                    {t(
                      '部分词只有旧版练习次数，缺少逐词过关结果，暂不算已过关。重新独立拼对两次即可确认；原有词库和练习记录保留。',
                    )}
                  </p>
                )}
                {data.decks.length > 0 && (
                  <label className="deck-switcher">
                    <span>
                      {t('切换词库（共 ')}
                      {data.decks.length}
                      {t(' 个）')}
                    </span>
                    <select
                      aria-label={t('切换词库')}
                      value={deckId || ''}
                      onChange={(e) => {
                        setDeckId(e.target.value || null);
                        setSearch('');
                        setFilter('all');
                      }}
                    >
                      <option value="">
                        {t('全部词库 · ')}
                        {data.words.length}
                        {t(' 个词')}
                      </option>
                      {data.decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {data.words.filter((w) => w.deckId === d.id).length}
                          {t(' 个词')}
                        </option>
                      ))}
                    </select>
                    <small>{t('导入新材料会新建独立词库，已有词库和学习进度会保留。')}</small>
                  </label>
                )}
                {!deckId && (
                  <div className="deck-grid library-decks">
                    {data.decks.map((d, i) => (
                      <DeckCard
                        key={d.id}
                        deck={d}
                        words={data.words.filter((w) => w.deckId === d.id)}
                        index={i}
                        onOpen={() => {
                          setDeckId(d.id);
                          setFilter('all');
                          setSearch('');
                        }}
                      />
                    ))}
                  </div>
                )}
                {currentDeck && (
                  <div className="deck-toolbar">
                    <button
                      className="text-button"
                      onClick={() => {
                        setDeckId(null);
                        setSearch('');
                        setFilter('all');
                      }}
                    >
                      <ArrowLeft size={15} />
                      {t('全部词库')}
                    </button>
                    <div>
                      <button
                        className="text-button"
                        onClick={() => setRenaming({ id: currentDeck.id, name: currentDeck.name })}
                      >
                        <Pencil size={15} />
                        {t('重命名')}
                      </button>
                      {currentDeck.pending.length > 0 && (
                        <button
                          className="pending-button"
                          onClick={() => openImport(false, currentDeck)}
                        >
                          <AlertCircle size={15} />
                          {currentDeck.pending.length}
                          {t(' 条待整理')}
                        </button>
                      )}
                      <button className="text-button" onClick={exportCsv}>
                        <Download size={16} />
                        {t('导出词条')}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={t('删除词库')}
                        onClick={() => {
                          if (
                            active &&
                            s?.ids.some((id) =>
                              data.words.some((w) => w.id === id && w.deckId === deckId),
                            )
                          ) {
                            setToast(t('请先完成或结束当前练习，再删除词库。'));
                            return;
                          }
                          if (
                            window.confirm(
                              t('删除「{0}」和其中全部词条？此操作不能撤销。', currentDeck.name),
                            )
                          ) {
                            setData((old) => ({
                              ...old,
                              decks: old.decks.filter((d) => d.id !== deckId),
                              words: old.words.filter((w) => w.deckId !== deckId),
                              session: null,
                            }));
                            setDeckId(null);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {currentDeck && (
                  <div className="deck-group-summary">
                    <div>
                      <span className="eyebrow">TEN WORDS AT A TIME</span>
                      <strong>
                        {(() => {
                          const groups = allGroups.filter((g) => g.deckId === currentDeck.id);
                          const next = recommendedGroup(groups);
                          return next ? t('接着学习第 {0} 组', next.number) : t('所有分组都已过关');
                        })()}
                      </strong>
                    </div>
                    <span>
                      {allGroups.filter((g) => g.deckId === currentDeck.id && g.completed).length} /{' '}
                      {allGroups.filter((g) => g.deckId === currentDeck.id).length}
                      {t(' 组已过关')}
                    </span>
                  </div>
                )}
                <div className="collection-panel">
                  <div className="collection-controls">
                    <div className="tabs">
                      {[
                        ['all', t('全部单词')],
                        ['new', t('未学')],
                        ['due', t('待复习')],
                        ['favorite', t('收藏')],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          className={filter === v ? 'selected' : ''}
                          onClick={() => setFilter(v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label={t('搜索单词或释义')}
                        placeholder={t('搜索单词或释义')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  {allPool.length ? (
                    <>
                      <div className="word-table">
                        <div className="word-row table-head">
                          <span>{t('瑞典语 / SVENSKA')}</span>
                          <span>{t('释义与备注')}</span>
                          <span>{t('学习状态')}</span>
                          <span />
                        </div>
                        {allPool.slice(0, 200).map((w) => (
                          <div key={w.id} className="word-row">
                            <div className="term-cell">
                              <button
                                className={`favorite ${w.favorite ? 'is-favorite' : ''}`}
                                aria-label={w.favorite ? t('取消收藏') : t('收藏单词')}
                                onClick={() =>
                                  setData((old) => ({
                                    ...old,
                                    words: old.words.map((p) =>
                                      p.id === w.id ? { ...p, favorite: !p.favorite } : p,
                                    ),
                                  }))
                                }
                              >
                                <Star size={15} fill={w.favorite ? 'currentColor' : 'none'} />
                              </button>
                              <span lang="sv">{w.term}</span>
                            </div>
                            <div>
                              <span>{w.meaning}</span>
                              {w.note && <small>{w.note}</small>}
                              {w.ai && (
                                <small className="ai-word-marker">
                                  {w.ai.mode === 'generated'
                                    ? t('AI 生成 · SFI {0}', w.ai.sfiLevel || '')
                                    : t('AI 整理')}{' '}
                                  ·{' '}
                                  {w.ai.meaningOrigin === 'source'
                                    ? t('原文释义')
                                    : w.ai.meaningOrigin === 'edited'
                                      ? t('手动修改')
                                      : t('AI 补充释义')}
                                </small>
                              )}
                            </div>
                            <div>
                              <span className={`status-pill ${hasPassed(w) ? 'learned' : ''}`}>
                                {!hasPassed(w)
                                  ? w.sessions > 0 && w.passed === undefined
                                    ? t('待核验')
                                    : t('未过关')
                                  : w.due && w.due <= Date.now()
                                    ? t('待复习')
                                    : t('已过关')}
                              </span>
                            </div>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={t('朗读 {0}', w.term)}
                                onClick={() => speak(w.term, setToast)}
                              >
                                <Volume2 size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={t('编辑 {0}', w.term)}
                                onClick={() => setEdit({ ...w })}
                              >
                                <Pencil size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {allPool.length > 200 && (
                        <p className="muted">{t('当前展示前 200 个词，可搜索定位其他词条。')}</p>
                      )}
                      <div className="collection-footer">
                        <span>
                          {allPool.length}
                          {t(' 个词 ')}
                          <span className="muted">{t('· 每组 10 个')}</span>
                        </span>
                        <button className="button primary" onClick={() => openPicker(allPool)}>
                          {active ? t('继续上次练习') : t('开始一组练习')}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <Empty
                      title={
                        data.words.length ? t('这里暂时没有单词') : t('你的第一本词库，等你来填')
                      }
                      description={
                        data.words.length
                          ? t('换个筛选条件，或导入一些新词。')
                          : t('上传自己的笔记，也可以先用示例词库体验完整练习。')
                      }
                    >
                      <button className="button secondary" onClick={demoDeck}>
                        {t('试试示例词库')}
                        <ArrowRight size={16} />
                      </button>
                    </Empty>
                  )}
                </div>
              </section>
            )}
            {page === 'history' && (
              <section className="page-section">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">SMALL STEPS, EVERY DAY</span>
                    <h1>{t('每一点进步，都算数。')}</h1>
                    <p>{t('这里记录完成的练习，进度只保存在当前浏览器。')}</p>
                  </div>
                </div>
                <div className="history-summary">
                  <div>
                    <strong>{data.history.filter((h) => h.completed === h.words).length}</strong>
                    <span>{t('全部过关的练习')}</span>
                  </div>
                  <div>
                    <strong>{data.history.reduce((a, h) => a + h.words, 0)}</strong>
                    <span>{t('累计练词次数')}</span>
                  </div>
                  <div>
                    <strong>{data.history.reduce((a, h) => a + h.attempts, 0)}</strong>
                    <span>{t('拼写尝试')}</span>
                  </div>
                </div>
                {active && (
                  <button
                    className="resume-banner"
                    onClick={() => {
                      setTraining(true);
                      setIntro(false);
                    }}
                  >
                    <Pause size={19} />
                    <span>{t('你有一组尚未完成的练习')}</span>
                    <span>
                      {t('继续 ')}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                )}
                {data.history.length ? (
                  <div className="history-list">
                    {[...data.history].reverse().map((h) => (
                      <div key={h.id}>
                        <div className="history-icon">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <strong>
                            {h.words}
                            {t(' 个词的练习')}
                          </strong>
                          <p>
                            {new Date(h.date).toLocaleString(
                              language === 'en' ? 'en-GB' : 'zh-CN',
                              {
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </p>
                        </div>
                        <div className="history-numbers">
                          <strong>
                            {h.completed} / {h.words}
                          </strong>
                          <span>{t('达到本轮目标')}</span>
                        </div>
                        <span className={`status-pill ${h.completed === h.words ? 'learned' : ''}`}>
                          {h.completed === h.words ? t('全部过关') : t('未全过关（旧版）')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={t('第一步，就从今天开始')}
                    description={t('完成一组练习后，你的学习记录会出现在这里。')}
                  >
                    <button className="button primary" onClick={() => navigate('library')}>
                      {t('去练习')}
                      <ArrowRight size={16} />
                    </button>
                  </Empty>
                )}
              </section>
            )}
            {page === 'settings' && (
              <section className="page-section">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                    <h1>{t('你的词，也由你保管。')}</h1>
                    <p>
                      {t(
                        '词库保存在当前浏览器和网址中。本地测试页与线上网站的数据独立，可通过备份合并迁移。',
                      )}
                    </p>
                  </div>
                </div>
                <div className="settings-grid">
                  <AiConnectionSettings />
                  <article className="setting-card">
                    <ShieldCheck size={28} />
                    <h2>{t('本机保存')}</h2>
                    <p>
                      {t(
                        '词库、待整理内容与学习进度保存在当前浏览器的 IndexedDB。当前没有账号和跨设备同步，AI 整理仅在你明确同意后发送本次材料文字。',
                      )}
                    </p>
                    <span className="status-pill learned">{t('本机模式已启用')}</span>
                  </article>
                  <article className="setting-card">
                    <Download size={28} />
                    <h2>{t('完整备份')}</h2>
                    <p>
                      {t(
                        'JSON 包含词库、来源、待整理内容和学习进度；CSV 只导出词条，方便在其他工具中打开。',
                      )}
                    </p>
                    <div className="button-group">
                      <button className="button primary" onClick={exportBackup}>
                        {t('导出 JSON')}
                      </button>
                      <button className="button secondary" onClick={exportCsv}>
                        {t('导出 CSV')}
                      </button>
                    </div>
                  </article>
                  <article className="setting-card">
                    <Upload size={28} />
                    <h2>{t('合并导入备份')}</h2>
                    <p>
                      {t(
                        '从本地测试页或其他浏览器导出的 JSON 中新增词库，保留词条和学习进度。已有词库不会被覆盖，重复导入会跳过。',
                      )}
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => mergeBackupRef.current?.click()}
                    >
                      {t('合并导入备份')}
                    </button>
                  </article>
                  <article className="setting-card">
                    <RotateCcw size={28} />
                    <h2>{t('恢复备份')}</h2>
                    <p>
                      {t(
                        '选择之前导出的 JSON 文件，确认后替换本机记录。恢复前建议先备份现有内容。',
                      )}
                    </p>
                    <button className="button secondary" onClick={() => backupRef.current?.click()}>
                      {t('选择备份文件')}
                      <Upload size={16} />
                    </button>
                  </article>
                  <article className="setting-card">
                    <Volume2 size={28} />
                    <h2>{t('练习声音')}</h2>
                    <p>{t('答对后读出瑞典语，打字与判题都有声音反馈。可按你的习惯分别关闭。')}</p>
                    <SoundSettings settings={audioSettings} onChange={updateAudio} />
                  </article>
                  <article className="setting-card">
                    <Keyboard size={28} />
                    <h2>{t('练习规则')}</h2>
                    <p>
                      {t(
                        '每组固定 10 个词，默认继续未完成的组。å、ä、ö 严格区分；冠词在提示中展示，拼写时输入词本身。拼对一次后降低出现频率，独立拼对两次后本轮不再出现。未过关的词持续练习，直到全部过关；使用提示不计独立答对。复习从次日开始。',
                      )}
                    </p>
                  </article>
                </div>
              </section>
            )}
          </>
        )}
        {loadError && (
          <div className="empty">
            <button className="button secondary" onClick={() => location.reload()}>
              {t('刷新重试')}
            </button>
            <button className="text-button" onClick={() => backupRef.current?.click()}>
              {t('从 JSON 备份恢复')}
            </button>
          </div>
        )}
      </main>
      <input type="file" accept=".json" hidden ref={backupRef} onChange={(e) => void restore(e)} />
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={mergeBackupRef}
        onChange={(e) => void restore(e, true)}
      />
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {t(toast)}
        </div>
      )}
      {importing && (
        <Modal
          title={
            drafts
              ? t('确认你的单词')
              : importKind === 'topic'
                ? t('按主题生成词表')
                : t('把学习材料变成词库')
          }
          wide
          onClose={closeImport}
        >
          <div className="import-steps">
            <span className={!drafts ? 'step-active' : ''}>
              01 {importKind === 'topic' ? t('选择主题与课程') : t('上传学习材料')}
            </span>
            <ChevronRight size={14} />
            <span className={drafts ? 'step-active' : ''}>{t('02 理解与确认')}</span>
            <ChevronRight size={14} />
            <span>{t('03 开始练习')}</span>
          </div>
          {!drafts && !pendingDeck && (
            <div className="import-kind-switch" role="group" aria-label={t('创建词库方式')}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={importKind === 'material'}
                onClick={() => {
                  setImportKind('material');
                  setImportError('');
                  if (!importNameEdited.current) setDeckName(t('我的瑞典语笔记'));
                }}
              >
                {t('导入学习材料')}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={importKind === 'topic'}
                onClick={() => {
                  setImportKind('topic');
                  setImportError('');
                  if (!importNameEdited.current)
                    setDeckName(
                      `${topicOptions.topic.trim() || t('主题词表')} · SFI ${topicOptions.sfiLevel}`.slice(
                        0,
                        100,
                      ),
                    );
                }}
              >
                {t('按主题生成')}
              </button>
            </div>
          )}
          <div className="import-name import-name-early">
            <label className="field-label" htmlFor="deck-name">
              {t('词库名称')}
            </label>
            <div className="import-name-field">
              <input
                id="deck-name"
                maxLength={100}
                disabled={busy}
                value={deckName}
                placeholder={t('例如：第 2 单元、工作与职业')}
                onChange={(e) => {
                  importNameEdited.current = true;
                  setDeckName(e.target.value);
                }}
              />
              <small>
                {pendingDeck
                  ? t('正在整理此词库的待确认词条，学习进度会保留。')
                  : t(
                      '将新建一个独立词库，保留已有的 {0} 个词库和学习进度。同名词库也不会被覆盖。',
                      data.decks.length,
                    )}
              </small>
            </div>
          </div>
          {!drafts && <AiConnectionSummary onManage={() => setAiSettingsOpen(true)} />}
          {!drafts ? (
            importKind === 'topic' ? (
              <TopicGenerator
                options={topicOptions}
                onChange={changeTopic}
                status={aiState}
                onRefresh={refreshAiStatus}
                disabled={busy}
              />
            ) : (
              <>
                <AiOptions
                  options={aiOptions}
                  onChange={(patch) => {
                    setAiOptions((old) => ({ ...old, ...patch }));
                    setImportError('');
                  }}
                  status={aiState}
                  onRefresh={refreshAiStatus}
                  disabled={busy}
                />
                <button
                  className="upload-zone"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <span className="upload-icon">
                    <Upload size={28} />
                  </span>
                  <strong>{busy ? t('正在本机读取…') : t('选择笔记、词汇合集或课文')}</strong>
                  <span>{t('TXT、MD、CSV、Excel、Word、文字型 PDF')}</span>
                  <small>
                    {aiOptions.engine === 'ai'
                      ? t('最大 10 MB · PDF 最多 80 页 · AI 每批最多 30000 字符')
                      : t('最大 10 MB · PDF 最多 80 页 · 每批最多 2000 条')}
                  </small>
                </button>
                <div className="or-divider">
                  <span>{t('或者，直接粘贴')}</span>
                </div>
                <label className="field-label" htmlFor="notes">
                  {t('你的学习材料')}
                </label>
                <textarea
                  id="notes"
                  className="notes-input"
                  placeholder={t('en bok - 书，böcker\näta / 吃 / åt / ätit\nvacker 美丽的')}
                  value={text}
                  disabled={busy}
                  onChange={(e) => {
                    setText(e.target.value);
                    setBlocks(null);
                  }}
                />
                <div className="import-local">
                  <ShieldCheck size={15} />
                  {aiOptions.engine === 'ai'
                    ? t(
                        '{0} 字符 · {1} · AI 输出需要你核对',
                        text.length,
                        blocks ? blocks.length + t(' 个来源片段') : t('粘贴材料'),
                      )
                    : t('本机规则整理，不上传文件。不确定的内容会留给你确认。')}
                </div>
              </>
            )
          ) : (
            <>
              {aiSummary && (
                <div className="ai-summary" role="status">
                  {t(aiSummary)}
                </div>
              )}
              <div className="notice">
                <AlertCircle size={18} />
                <span>
                  {t(
                    '逐条确认词义与词形。未勾选的内容保留在「待整理」；相同词条与释义会合并备注，保留学习进度。',
                  )}
                </span>
              </div>
              <div className="draft-tools">
                <div className="tabs">
                  <button
                    className={draftFilter === 'all' ? 'selected' : ''}
                    onClick={() => setDraftFilter('all')}
                  >
                    {t('全部 ')}
                    {drafts.length}
                  </button>
                  <button
                    className={draftFilter === 'pending' ? 'selected' : ''}
                    onClick={() => setDraftFilter('pending')}
                  >
                    {t('需检查 ')}
                    {drafts.filter((d) => d.issue || !d.selected).length}
                  </button>
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder={t('筛选整理结果')}
                    aria-label={t('筛选整理结果')}
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="draft-list">
                {drafts
                  .filter(
                    (d) =>
                      (draftFilter === 'all' || d.issue || !d.selected) &&
                      `${d.term} ${d.meaning}`.includes(draftSearch),
                  )
                  .map((d) => (
                    <article key={d.id} className={`draft-row ${d.issue ? 'needs-review' : ''}`}>
                      <label className="draft-check">
                        <input
                          type="checkbox"
                          aria-label={t('导入 {0}', d.term || t('待补充词条'))}
                          checked={d.selected}
                          disabled={!d.term.trim() || !d.meaning.trim()}
                          onChange={(e) => changeDraft(d.id, { selected: e.target.checked })}
                        />
                      </label>
                      <div className="draft-fields">
                        <div className="draft-pair">
                          <label>
                            <span>{t('瑞典语')}</span>
                            <input
                              value={d.term}
                              maxLength={20000}
                              aria-label={t('瑞典语词条')}
                              onChange={(e) => changeDraft(d.id, { term: e.target.value })}
                            />
                          </label>
                          <label>
                            <span>{t('释义')}</span>
                            <input
                              value={d.meaning}
                              placeholder={t('补充释义')}
                              maxLength={20000}
                              aria-label={t('词条释义')}
                              onChange={(e) => changeDraft(d.id, { meaning: e.target.value })}
                            />
                          </label>
                        </div>
                        <label className="draft-note">
                          <span>{t('词形 / 备注')}</span>
                          <input
                            value={d.note}
                            placeholder={t('可选')}
                            maxLength={20000}
                            aria-label={t('词形或备注')}
                            onChange={(e) => changeDraft(d.id, { note: e.target.value })}
                          />
                        </label>
                        <AiEvidenceView evidence={d.ai} />
                        <details>
                          <summary>
                            {d.issue && <span className="review-label">{t(d.issue)} · </span>}
                            {d.ai?.mode === 'generated'
                              ? t('查看生成主题与课程')
                              : t('查看原文与来源')}
                          </summary>
                          <p className="source-text">{d.source}</p>
                          <small>{d.location}</small>
                        </details>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={t('移除 {0}', d.term)}
                        onClick={() =>
                          setDrafts((old) => old?.filter((x) => x.id !== d.id) || null)
                        }
                      >
                        <X size={16} />
                      </button>
                    </article>
                  ))}
              </div>
            </>
          )}
          {importError && (
            <p role="alert" className="inline-error">
              {t(importError)}
            </p>
          )}
          <div className="modal-footer">
            <div>
              {drafts ? (
                <>
                  <strong>
                    {drafts.filter((d) => d.selected && d.term.trim() && d.meaning.trim()).length}
                  </strong>{' '}
                  {t('条已勾选 · 其余保留待整理')}
                </>
              ) : importKind === 'topic' ? (
                <span className="topic-review-note">
                  {t('词条、释义和例句均由 AI 生成，保存前请核对。')}
                </span>
              ) : (
                <button
                  className="text-button"
                  onClick={() => {
                    setText(DEMO);
                    setBlocks(null);
                  }}
                >
                  {t('填入示例笔记')}
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
            <div className="button-group">
              {busy && abortAi.current && (
                <button className="button secondary" onClick={() => abortAi.current?.abort()}>
                  {t('取消整理')}
                </button>
              )}
              {drafts && !pendingDeck && (
                <button className="button secondary" onClick={() => setDrafts(null)}>
                  {importKind === 'topic' ? t('调整主题') : t('重新导入')}
                </button>
              )}
              {drafts ? (
                <button
                  className="button primary"
                  disabled={busy || !drafts.length || !deckName.trim()}
                  onClick={commitImport}
                >
                  {t('保存词库')}
                  <Check size={17} />
                </button>
              ) : importKind === 'topic' ? (
                <button
                  className="button primary"
                  disabled={busy || !topicOptions.topic.trim() || !aiState?.configured}
                  onClick={generateTopic}
                >
                  {busy ? t('AI 正在生成…') : t('生成词表')}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={
                    busy || !text.trim() || (aiOptions.engine === 'ai' && !aiState?.configured)
                  }
                  onClick={parse}
                >
                  {busy
                    ? t('AI 正在整理…')
                    : aiOptions.engine === 'ai'
                      ? t('用 AI 整理')
                      : t('整理单词')}
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
          <input
            hidden
            type="file"
            ref={fileRef}
            accept=".txt,.md,.csv,.xlsx,.docx,.pdf"
            onChange={upload}
          />
        </Modal>
      )}
      {aiSettingsOpen && (
        <Modal title={t('AI 设置')} onClose={() => setAiSettingsOpen(false)}>
          <AiConnectionSettings
            onSaved={() => {
              refreshAiStatus();
              setAiSettingsOpen(false);
            }}
          />
        </Modal>
      )}
      {renaming && (
        <Modal title={t('修改词库名称')} onClose={() => setRenaming(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = renaming.name.trim();
              if (!name || name.length > 100) return;
              setData((old) => ({
                ...old,
                decks: old.decks.map((d) => (d.id === renaming.id ? { ...d, name } : d)),
              }));
              setRenaming(null);
              setToast(t('词库名称已更新。'));
            }}
          >
            <div className="rename-form">
              <label className="field-label" htmlFor="rename-deck">
                {t('新的词库名称')}
              </label>
              <input
                id="rename-deck"
                autoFocus
                maxLength={100}
                placeholder={t('例如：第 2 单元、工作与职业')}
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              />
              <p>{t('用单元、主题或分类来命名，方便找到想练习的内容。')}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setRenaming(null)}>
                {t('取消')}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={!renaming.name.trim() || renaming.name.trim().length > 100}
              >
                {t('保存名称')}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title={t('编辑词条')} onClose={() => setEdit(null)}>
          <div className="edit-form">
            <label>
              {t('瑞典语')}
              <input
                maxLength={20000}
                value={edit.term}
                onChange={(e) => setEdit({ ...edit, term: e.target.value })}
              />
            </label>
            <label>
              {t('释义')}
              <input
                maxLength={20000}
                value={edit.meaning}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    meaning: e.target.value,
                    ai: edit.ai ? { ...edit.ai, meaningOrigin: 'edited' } : undefined,
                  })
                }
              />
            </label>
            <label>
              {t('词形与备注')}
              <input
                maxLength={20000}
                value={edit.note}
                onChange={(e) => setEdit({ ...edit, note: e.target.value })}
              />
            </label>
            <AiEvidenceView evidence={edit.ai} />
            <details>
              <summary>
                {edit.ai?.mode === 'generated' ? t('查看生成主题与课程') : t('查看原文与来源')}
              </summary>
              <p className="source-text">{edit.source}</p>
              <small>{edit.location}</small>
            </details>
            <p className="muted">{t('修改词条会保留学习进度。')}</p>
          </div>
          <div className="modal-footer">
            <button
              className="text-button danger"
              onClick={() => {
                if (active && s?.ids.includes(edit.id)) {
                  setToast(t('这个词正在练习中，请先完成或结束练习。'));
                  return;
                }
                if (window.confirm(t('删除 {0}？', edit.term))) {
                  setData((old) => ({
                    ...old,
                    words: old.words.filter((w) => w.id !== edit.id),
                    session: null,
                  }));
                  setEdit(null);
                }
              }}
            >
              <Trash2 size={16} />
              {t('删除词条')}
            </button>
            <button
              className="button primary"
              disabled={!edit.term.trim() || !edit.meaning.trim()}
              onClick={() => {
                if (active && s?.ids.includes(edit.id)) {
                  setToast(t('这个词正在练习中，请先完成或结束练习。'));
                  return;
                }
                const normalizedEdit = {
                  ...edit,
                  term: edit.term.trim(),
                  meaning: edit.meaning.trim(),
                };
                if (
                  data.words.some(
                    (w) =>
                      w.id !== edit.id &&
                      w.deckId === edit.deckId &&
                      wordKey(w) === wordKey(normalizedEdit),
                  )
                ) {
                  setToast(t('词库中已有相同词条和释义，请修改后再保存。'));
                  return;
                }
                setData((old) => ({
                  ...old,
                  words: old.words.map((w) => (w.id === edit.id ? normalizedEdit : w)),
                }));
                setEdit(null);
              }}
            >
              {t('保存修改')}
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {picking && (
        <Modal
          title={reviewAll ? t('主动巩固') : reviewPicker ? t('到期复习') : t('接着学，每组 10 个')}
          onClose={() => setPicking(false)}
          className="study-picker"
        >
          <div className="picker-body">
            <div className="picker-deck-control">
              <label htmlFor="practice-deck">{t('练习词库')}</label>
              <select
                id="practice-deck"
                value={pickerDeck || ''}
                onChange={(event) => selectPickerDeck(event.target.value)}
              >
                {pickerDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
              <p>{t('一次专注一个词库，每组最多 10 个词。')}</p>
            </div>
            <div className="group-picker-tabs">
              <button
                className={!manualPick ? 'selected' : ''}
                onClick={() => {
                  setManualPick(false);
                  const group = reviewAll
                    ? pickerGroups[0]
                    : recommendedGroup(pickerGroups, reviewPicker);
                  setChosenGroup(group?.key || null);
                  setSelected(
                    group
                      ? (reviewAll ? group.words : groupWords(group, reviewPicker)).map((w) => w.id)
                      : [],
                  );
                }}
              >
                {t('按组练习')}
              </button>
              <button className={manualPick ? 'selected' : ''} onClick={() => setManualPick(true)}>
                {t('自己选词')}
              </button>
            </div>
            {!manualPick ? (
              <GroupChoices
                groups={pickerGroups}
                selectedKey={chosenGroup}
                onChoose={chooseGroup}
                review={reviewPicker}
                allReview={reviewAll}
              />
            ) : (
              <>
                <p className="picker-help">
                  {t('自由挑选最多 20 个词；也可以回到按组练习，一键开始下一组。')}
                </p>
                <div className="picker-list">
                  {visiblePickerWords.map((w) => (
                    <label key={w.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(w.id)}
                        disabled={!selected.includes(w.id) && selected.length >= 20}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked ? [...old, w.id] : old.filter((id) => id !== w.id),
                          )
                        }
                      />
                      <strong lang="sv">{w.term}</strong>
                      <span>{w.meaning}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <span className="picker-selection-summary">
              <span>
                {data.decks.find((d) => d.id === pickerDeck)?.name}
                {!manualPick &&
                  chosenGroup &&
                  ` · ${t('第 {0} 组', pickerGroups.find((g) => g.key === chosenGroup)?.number)}`}
              </span>
              {manualPick ? t('已选') : t('本次练习')} <strong>{selected.length}</strong>
              {t(' 个词')}
            </span>
            <button className="button primary" disabled={!selected.length} onClick={begin}>
              {t('开始练习')}
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {training && s && (
        <div className="training-overlay">
          <header className="training-header">
            <span className="brand">
              ord<span>.</span>
            </span>
            <span className="training-header-label">
              {s.finished
                ? t('本轮练习完成')
                : intro
                  ? t('认识这一组单词')
                  : t('专心这一刻，一次一个词')}
            </span>
            <div className="training-header-actions">
              <LanguageSwitch />
              <SoundSettings settings={audioSettings} onChange={updateAudio} compact />
              <button className="button secondary" onClick={() => setTraining(false)}>
                {s.finished ? t('返回词库') : t('保存并退出')}
                {s.finished ? <X size={16} /> : <Pause size={16} />}
              </button>
            </div>
          </header>
          {s.finished ? (
            <div className="result-screen">
              <div className="finish-mark">
                <Check size={36} />
              </div>
              <span className="eyebrow">BRA JOBBAT!</span>
              <h1>{t('今天，又前进了一点。')}</h1>
              <p>
                {t('完成了 ')}
                {s.ids.length}
                {t(' 个词的练习。已经学过的组会记住，下次接着下一组。')}
              </p>
              <div className="result-stats">
                <div>
                  <strong>
                    {Object.values(s.scores).filter((v) => v.wins >= 2).length}
                    <small> / {s.ids.length}</small>
                  </strong>
                  <span>{t('达到两次独立拼对')}</span>
                </div>
                <div>
                  <strong>{Object.values(s.scores).reduce((a, v) => a + v.tries, 0)}</strong>
                  <span>{t('拼写尝试')}</span>
                </div>
                <div>
                  <strong>{t('明天')}</strong>
                  <span>{t('下一次复习')}</span>
                </div>
              </div>
              <div className="result-words">
                {s.ids.map((id) => {
                  const w = data.words.find((w) => w.id === id),
                    score = s.scores[id];
                  return w ? (
                    <div key={id}>
                      <span lang="sv">{w.term}</span>
                      <span>{w.meaning}</span>
                      <span className={`status-pill ${score.wins >= 2 ? 'learned' : ''}`}>
                        {score.wins >= 2 ? t('本轮达标') : t('再巩固一下')}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setTraining(false);
                  navigate('library');
                }}
              >
                {t('回到词库')}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : intro ? (
            <div className="intro-screen">
              <span className="eyebrow">MEET YOUR WORDS</span>
              <h1>{t('先打个招呼。')}</h1>
              <p>
                {t('快速认识这 ')}
                {s.ids.length}
                {t(' 个词，准备好后开始选择与拼写。')}
              </p>
              <div className="intro-grid">
                {s.ids.map((id) => {
                  const w = data.words.find((w) => w.id === id)!;
                  return (
                    <div key={id}>
                      <div>
                        <strong lang="sv">{w.term}</strong>
                        <button
                          className="icon-button"
                          aria-label={t('朗读 {0}', w.term)}
                          onClick={() => speak(w.term, setToast)}
                        >
                          <Volume2 size={17} />
                        </button>
                      </div>
                      <p>{w.meaning}</p>
                      {w.note && <small>{w.note}</small>}
                    </div>
                  );
                })}
              </div>
              <button className="button primary" onClick={() => setIntro(false)}>
                {t('准备好了，开始')}
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <Practice
              session={s}
              words={data.words}
              spellRef={spellRef}
              onAnswer={answer}
              onNext={next}
              onUpdate={updateSession}
              onToast={setToast}
              audioSettings={audioSettings}
            />
          )}
          {!s.finished && (
            <footer className="training-bottom">
              <span>
                <ShieldCheck size={14} />
                {t('进度自动保存在本机')}
              </span>
              <button
                className="text-button"
                onClick={() => {
                  if (
                    window.confirm(t('结束这组练习？已完成的往期记录会保留，本组不计入完成记录。'))
                  ) {
                    setData((old) => ({ ...old, session: null }));
                    setTraining(false);
                  }
                }}
              >
                {t('结束本组')}
              </button>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
function DeckCard({
  deck,
  words,
  index,
  onOpen,
}: {
  deck: Deck;
  words: Word[];
  index: number;
  onOpen: () => void;
}) {
  const learned = words.filter(hasPassed).length;
  return (
    <button className={`deck-card tone-${index % 3}`} onClick={onOpen}>
      <div className="deck-icon">
        <BookOpen size={23} />
      </div>
      <span className="deck-number">{String(index + 1).padStart(2, '0')}</span>
      <h3>{deck.name}</h3>
      <p>
        {words.length}
        {t(' 个词')}{' '}
        {deck.pending.length ? t('· {0} 条待整理', deck.pending.length) : t('· 我的个人词库')}
      </p>
      <div className="deck-progress">
        <div style={{ width: `${words.length ? (learned / words.length) * 100 : 0}%` }} />
      </div>
      <div className="deck-footer">
        <span>
          {t('已过关 ')}
          {learned} / {words.length}
        </span>
        <span className="circle-arrow">
          <ArrowUpRight size={19} />
        </span>
      </div>
    </button>
  );
}
function Practice({
  session: s,
  words,
  spellRef,
  onAnswer,
  onNext,
  onUpdate,
  onToast,
  audioSettings,
}: {
  audioSettings: AudioSettings;
  session: Session;
  words: Word[];
  spellRef: React.RefObject<HTMLInputElement | null>;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  onUpdate: (s: Session) => void;
  onToast: (text: string) => void;
}) {
  const task = s.tasks[s.position],
    word = words.find((w) => w.id === task.wordId)!;
  const isSpell = task.type === 'spell',
    target = spellingAnswer(word),
    noOptions = !isSpell && !task.options?.length;
  const article = word.term.match(/^(en|ett)\s+/i)?.[1];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.feedback && e.key === 'Enter') {
        e.preventDefault();
        onNext();
      } else if (!isSpell && !s.feedback && task.options?.length && /^[1-4]$/.test(e.key)) {
        const option = task.options[Number(e.key) - 1];
        if (option) {
          e.preventDefault();
          onAnswer(option);
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [s.feedback, s.position, s.turn, isSpell, task.options, onNext, onAnswer]);
  function insert(char: string) {
    if (audioSettings.typingSound) typingSound(onToast);
    const input = spellRef.current;
    const start = input?.selectionStart ?? s.input.length,
      end = input?.selectionEnd ?? start;
    const value = s.input.slice(0, start) + char + s.input.slice(end);
    onUpdate({ ...s, input: value });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + 1, start + 1);
    });
  }
  return (
    <div className="practice-wrap">
      <div className="practice-progress">
        <div>
          <span>{isSpell ? t('02 / 拼写回忆') : t('01 / 词义热身')}</span>
          <span>
            {t('已过关 ')}
            {s.ids.filter((id) => s.scores[id].wins >= 2).length} / {s.ids.length}
            {t(' 个词')}
            <span className="muted">
              {t(' · 第 ')}
              {(s.turn ?? s.position) + 1}
              {t(' 题')}
            </span>
          </span>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${(s.ids.reduce((total, id) => total + Math.min(s.scores[id].wins, 2), 0) / (s.ids.length * 2)) * 100}%`,
            }}
          />
        </div>
      </div>
      <article
        key={`${s.id}:${s.turn ?? s.position}`}
        className={`practice-card ${s.feedback ? `has-feedback ${s.feedback.correct ? 'answer-correct' : 'answer-wrong'}` : ''}`}
      >
        <div className="practice-topline">
          <span className="tag">{isSpell ? t('把记忆写出来') : t('先认出它的意思')}</span>
          <button
            className={`favorite ${word.favorite ? 'is-favorite' : ''}`}
            disabled
            aria-label={t('单词收藏状态')}
          >
            <Star size={18} fill={word.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <span className="eyebrow">
          {isSpell ? t('用瑞典语怎么说？') : t('这个词，是什么意思？')}
        </span>
        <h1 lang={isSpell ? 'zh-CN' : 'sv'} className={isSpell ? 'meaning-prompt' : ''}>
          {isSpell ? word.meaning : word.term}
        </h1>
        {isSpell ? (
          <>
            <p className="question-note">
              {article
                ? t('名词 · {0} · 只输入词本身，不含冠词', article)
                : t('输入词条原形；短语请完整输入')}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!s.feedback && s.input.trim()) onAnswer(s.input);
              }}
            >
              <input
                ref={spellRef}
                className={`spell-input ${s.feedback ? (s.feedback.correct ? 'correct' : 'incorrect') : ''}`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={t('输入瑞典语答案')}
                placeholder={t('在这里输入瑞典语…')}
                value={s.input}
                disabled={!!s.feedback}
                onKeyDown={(e) => {
                  if (
                    audioSettings.typingSound &&
                    !e.nativeEvent.isComposing &&
                    !e.ctrlKey &&
                    !e.metaKey &&
                    (e.key.length === 1 || ['Backspace', 'Delete'].includes(e.key))
                  )
                    typingSound(onToast);
                }}
                onChange={(e) => {
                  const native = e.nativeEvent as InputEvent;
                  if (
                    audioSettings.typingSound &&
                    !native.isComposing &&
                    native.inputType &&
                    /^(insertText|delete)/.test(native.inputType)
                  )
                    typingSound(onToast);
                  onUpdate({ ...s, input: e.target.value });
                }}
              />
              <div className="keyboard-row">
                <div>
                  {['å', 'ä', 'ö'].map((c) => (
                    <button type="button" key={c} disabled={!!s.feedback} onClick={() => insert(c)}>
                      {c}
                    </button>
                  ))}
                </div>
                {!s.feedback && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={s.hinted}
                    onClick={() => onUpdate({ ...s, hinted: true })}
                  >
                    <Eye size={15} />
                    {s.hinted ? t('已使用提示') : t('看一眼提示')}
                  </button>
                )}
              </div>
              {s.hinted && !s.feedback && (
                <div className="hint-line">
                  {t('开头是 ')}
                  <strong>{target.slice(0, 1)}</strong>
                  {t(' · 共 ')}
                  {target.length}
                  {t(' 个字符 · 本题不计独立答对')}
                </div>
              )}
              {!s.feedback && (
                <div className="answer-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onUpdate(answerSession({ ...s, hinted: true }, word, ''));
                    }}
                  >
                    {t('不记得，看看答案')}
                  </button>
                  <button type="submit" className="button primary" disabled={!s.input.trim()}>
                    {t('检查答案')}
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </form>
          </>
        ) : noOptions ? (
          <div className="flash-recall">
            <p>{t('词库还小，先翻卡回忆，不勉强凑选择题。')}</p>
            {s.feedback ? (
              <strong>{word.meaning}</strong>
            ) : (
              <button className="button secondary" onClick={() => onAnswer(word.meaning)}>
                {t('翻开释义')}
                <Eye size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="choice-options">
            {task.options?.map((option, i) => (
              <button
                key={option}
                disabled={!!s.feedback}
                className={
                  s.feedback
                    ? option === word.meaning
                      ? 'option correct'
                      : option === s.feedback.answer
                        ? 'option incorrect'
                        : 'option'
                    : 'option'
                }
                onClick={() => onAnswer(option)}
              >
                <span className="option-index">{String.fromCharCode(65 + i)}</span>
                <span>{option}</span>
                {s.feedback && option === word.meaning && <Check size={18} />}
              </button>
            ))}
          </div>
        )}
        {s.feedback && (
          <div
            className={`answer-feedback ${s.feedback.correct ? 'positive' : 'negative'}`}
            role="status"
          >
            <div>
              <strong>
                {noOptions
                  ? t('记住它，下一步试着拼写')
                  : s.feedback.correct
                    ? s.feedback.assisted
                      ? t('有提示也没关系，再独立试一次')
                      : t('答对了，记忆又清晰了一点')
                    : t('没关系，我们再记一次')}
              </strong>
              {isSpell && (
                <div className="correct-answer" lang="sv">
                  {target.split('').map((c, i) => (
                    <span
                      key={i}
                      className={
                        !s.feedback!.correct &&
                        normalize(s.feedback!.answer[i] || '') !== normalize(c)
                          ? 'letter-difference'
                          : ''
                      }
                    >
                      {c === ' ' ? '\u00a0' : c}
                    </span>
                  ))}
                </div>
              )}
              {!isSpell && !noOptions && <p>{word.meaning}</p>}
              {word.note && (
                <p className="answer-note">
                  {t('词形 / 备注：')}
                  {word.note}
                </p>
              )}
              <AiEvidenceView evidence={word.ai} />
              <button className="text-button" onClick={() => speak(word.term, onToast)}>
                <Volume2 size={16} />
                {t('听发音')}
              </button>
            </div>
            <button className="button primary" onClick={onNext}>
              {t('继续')}
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </article>
      <div className="practice-caption">
        <Leaf size={15} />
        {isSpell
          ? t(
              '这个词已独立拼对 {0} / 2 次 · {1}',
              s.scores[word.id].wins,
              s.scores[word.id].wins >= 2
                ? t('本轮已过关，不再出现')
                : s.scores[word.id].wins === 1
                  ? t('已降低频率，再拼对一次即可过关')
                  : t('继续练习，直到独立拼对两次'),
            )
          : t('认得出来，是记住它的第一步。')}
      </div>
    </div>
  );
}
