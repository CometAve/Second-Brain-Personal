import type { ComponentPropsWithRef, HTMLAttributes } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/cn';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

type AlertDialogOverlayProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Overlay>;

function AlertDialogOverlay({ className, ref, ...props }: AlertDialogOverlayProps) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn('fixed inset-0 z-200 bg-black/65 backdrop-blur-xs', className)}
      {...props}
      ref={ref}
    />
  );
}

type AlertDialogContentProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Content>;

function AlertDialogContent({ className, ref, ...props }: AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed top-[50%] left-[50%] z-210 grid w-[calc(100%-2rem)] max-w-md transform-[translate(-50%,-50%)] gap-6 rounded-2xl border border-white/12 bg-card p-6 text-foreground shadow-[0_24px_80px_#0009]',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

type AlertDialogHeaderProps = HTMLAttributes<HTMLDivElement>;

function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  );
}

type AlertDialogFooterProps = HTMLAttributes<HTMLDivElement>;

function AlertDialogFooter({ className, ...props }: AlertDialogFooterProps) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-x-2', className)}
      {...props}
    />
  );
}

type AlertDialogTitleProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Title>;

function AlertDialogTitle({ className, ref, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold text-white', className)}
      {...props}
    />
  );
}

type AlertDialogDescriptionProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Description>;

function AlertDialogDescription({ className, ref, ...props }: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn('text-sm leading-6 text-muted-foreground', className)}
      {...props}
    />
  );
}

type AlertDialogActionProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Action>;

function AlertDialogAction({ className, ref, ...props }: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg border border-red-500 bg-white/10 px-4 py-2 text-sm font-medium text-red-500 backdrop-blur-lg transition-colors hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:outline-hidden active:bg-red-500/30 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

type AlertDialogCancelProps = ComponentPropsWithRef<typeof AlertDialogPrimitive.Cancel>;

function AlertDialogCancel({ className, ref, ...props }: AlertDialogCancelProps) {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(
        'mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-lg transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-hidden active:bg-white/30 disabled:pointer-events-none disabled:opacity-50 sm:mt-0',
        className,
      )}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
