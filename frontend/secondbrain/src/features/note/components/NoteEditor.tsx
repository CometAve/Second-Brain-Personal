import { useEffect, useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import { editorViewCtx, editorViewOptionsCtx, serializerCtx } from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, $remark } from '@milkdown/kit/utils';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { toast } from 'sonner';
import {
  accessibleListItemView,
  listMarkerSync,
} from '@/features/note/components/accessibleListItemView';
import { readInlineImage } from '@/features/note/components/imageUpload';
import '@/features/note/components/NoteEditor.css';

type NoteEditorProps = {
  documentId: string;
  initialMarkdown: string;
  readOnly?: boolean;
  onMarkdownChange?: (markdown: string) => void;
  onReady?: () => void;
  onInitializationError?: () => void;
  ref?: Ref<NoteEditorHandle>;
};

export type NoteEditorHandle = { focus: () => void };

function normalizeImageTitle(node: unknown): void {
  if (node === null || typeof node !== 'object') return;
  // Crepe serializes an empty caption without a Markdown title. Remark parses
  // that as null, but Crepe's image-block schema requires a string and would
  // silently drop the node when reopening the note.
  if (
    'type' in node &&
    (node.type === 'image' || node.type === 'image-block') &&
    (!('title' in node) || node.title == null)
  ) {
    Object.assign(node, { title: '' });
  }
  if ('children' in node && Array.isArray(node.children)) {
    node.children.forEach(normalizeImageTitle);
  }
}

const imageTitleCompatibility = $remark('note-image-title-compatibility', () => () => (tree) => {
  normalizeImageTitle(tree);
});

async function uploadInlineImage(file: File): Promise<string> {
  try {
    return await readInlineImage(file);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '이미지를 추가하지 못했습니다.');
    // Crepe ignores an empty result; rejecting only logs to the console.
    return '';
  }
}

function CrepeEditor({
  initialMarkdown,
  readOnly = false,
  onMarkdownChange,
  onReady,
  onInitializationError,
  ref,
}: NoteEditorProps) {
  const onChangeRef = useRef(onMarkdownChange);
  const onReadyRef = useRef(onReady);
  const onInitializationErrorRef = useRef(onInitializationError);
  const initializationReportedRef = useRef(false);
  const crepeRef = useRef<Crepe | null>(null);
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onMarkdownChange;
    onReadyRef.current = onReady;
    onInitializationErrorRef.current = onInitializationError;
  }, [onMarkdownChange, onReady, onInitializationError]);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  const { loading, get } = useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: initialMarkdown,
      features: { [Crepe.Feature.ListItem]: false },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: '내용을 입력하거나 /로 블록을 추가하세요.',
          mode: 'block',
        },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: '텍스트',
            text: { label: '본문 · text' },
            h1: { label: '제목 1 · h1' },
            h2: { label: '제목 2 · h2' },
            h3: { label: '제목 3 · h3' },
            h4: { label: '제목 4 · h4' },
            h5: { label: '제목 5 · h5' },
            h6: { label: '제목 6 · h6' },
            quote: { label: '인용 · quote' },
            divider: { label: '구분선 · divider' },
          },
          listGroup: {
            label: '목록',
            bulletList: { label: '글머리 기호 · bullet' },
            orderedList: { label: '번호 목록 · number' },
            taskList: { label: '할 일 · todo' },
          },
          advancedGroup: {
            label: '삽입',
            image: { label: '이미지 · image' },
            codeBlock: { label: '코드 · code' },
            table: { label: '표 · table' },
            math: { label: '수식 · math' },
          },
        },
        [Crepe.Feature.Toolbar]: {
          boldLabel: '굵게',
          italicLabel: '기울임',
          strikethroughLabel: '취소선',
          codeLabel: '인라인 코드',
          latexLabel: '인라인 수식',
          linkLabel: '링크',
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadInlineImage,
          inlineUploadButton: '이미지 선택 · 최대 512KB',
          inlineConfirmButton: '확인',
          inlineUploadPlaceholderText: '또는 이미지 주소 붙여넣기',
          blockUploadButton: '이미지 선택 · 최대 512KB',
          blockConfirmButton: '확인',
          blockCaptionPlaceholderText: '이미지 설명',
          blockUploadPlaceholderText: '또는 이미지 주소 붙여넣기',
        },
      },
    });
    crepe.setReadonly(readOnly);
    crepe.editor.config((ctx) => {
      ctx.update(editorViewOptionsCtx, (options) => ({
        ...options,
        attributes: (state) => ({
          ...(typeof options.attributes === 'function'
            ? options.attributes(state)
            : options.attributes),
          'aria-label': '노트 본문',
          'aria-multiline': 'true',
        }),
      }));
    });
    crepe.editor.use(imageTitleCompatibility);
    crepe.editor.use(accessibleListItemView);
    crepe.editor.use(listMarkerSync);
    // Crepe's default paste/drop uploader creates nodes even when onUpload
    // returns an empty string. Override that path so invalid files never leave
    // blank images or temporary blob: URLs in a saved note.
    crepe.editor.config((ctx) => {
      ctx.update(uploadConfig.key, (options) => ({
        ...options,
        uploader: async (files, schema) => {
          const imageType = schema.nodes['image-block'] ?? schema.nodes.image;
          if (!imageType) return [];
          const nodes = await Promise.all(
            Array.from(files).map(async (file) => {
              try {
                const src = await readInlineImage(file);
                return imageType.createAndFill({ src });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : '이미지를 추가하지 못했습니다.',
                );
                return null;
              }
            }),
          );
          return nodes.filter((node) => node !== null);
        },
      }));
    });
    const immediateChanges = $prose(
      (ctx) =>
        new Plugin({
          view: () => ({
            update(view, previousState) {
              if (previousState.doc.eq(view.state.doc)) return;
              onChangeRef.current?.(ctx.get(serializerCtx)(view.state.doc));
            },
          }),
        }),
    );
    crepe.editor.use(immediateChanges);
    crepeRef.current = crepe;
    return crepe;
  }, []);

  useEffect(() => {
    if (loading || initializationReportedRef.current) return;
    initializationReportedRef.current = true;
    if (get()) onReadyRef.current?.();
    else onInitializationErrorRef.current?.();
  }, [get, loading]);

  useEffect(() => {
    if (loading) return;
    get()?.action((ctx) => {
      ctx
        .get(editorViewCtx)
        .dom.querySelectorAll<HTMLInputElement>('[data-note-task-checkbox]')
        .forEach((checkbox) => {
          checkbox.disabled = readOnly;
        });
    });
  }, [get, loading, readOnly]);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        const editor = get();
        if (loading || !editor) {
          pendingFocusRef.current = true;
          return;
        }
        editor.action((ctx) => ctx.get(editorViewCtx).focus());
      },
    }),
    [get, loading],
  );

  useEffect(() => {
    const editor = get();
    if (!loading && editor && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      editor.action((ctx) => ctx.get(editorViewCtx).focus());
    }
  }, [get, loading]);

  return <Milkdown />;
}

/** One editor identity captures one verified initial document, never a later query refetch. */
export function NoteEditor(props: NoteEditorProps) {
  return (
    <section className="note-editor" aria-label="노트 편집 영역">
      <MilkdownProvider key={props.documentId}>
        <CrepeEditor {...props} />
      </MilkdownProvider>
    </section>
  );
}
