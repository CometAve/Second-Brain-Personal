import type { ReactNode } from 'react';
import { BaseLayout } from '@/layouts/BaseLayout';
import { GlassElement } from '@/shared/components/GlassElement/GlassElement';
import BackArrowIcon from '@/shared/components/icon/BackArrow.svg?react';
import DeleteIcon from '@/shared/components/icon/Delete.svg?react';
import PlusIcon from '@/shared/components/icon/Plus.svg?react';

interface NoteLayoutProps {
  children: ReactNode;
}

const NoteLayout = ({ children }: NoteLayoutProps) => {
  return (
    <BaseLayout>
      <div className="fixed top-10 left-10">
        <GlassElement as="button" icon={<BackArrowIcon />} />
      </div>

      <div className="fixed top-10 right-10">
        <GlassElement as="button" icon={<DeleteIcon />} />
      </div>

      <div className="fixed right-10 bottom-10">
        <GlassElement as="button" icon={<PlusIcon />} />
      </div>

      {children}
    </BaseLayout>
  );
};

export { NoteLayout };
