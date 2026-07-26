"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

type ResponsiveSheetProps = {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
};

const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

export function ResponsiveSheet({
  children,
  isOpen,
  onOpenChange,
  title,
}: ResponsiveSheetProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  if (isDesktop) {
    return (
      <Dialog onOpenChange={onOpenChange} open={isOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 overflow-y-auto">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={isOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-3 overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

export function useResponsiveSheet(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return {
    close: () => setIsOpen(false),
    isOpen,
    onOpenChange: setIsOpen,
    open: () => setIsOpen(true),
  };
}
