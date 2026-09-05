import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { journalTourSteps } from "@/components/product-tours/journal-tour";
import { profileTourSteps, TourDestinations } from "@/components/product-tours/profile-tour-pages";
import type { ProductTourStepProps } from "@/components/product-tours/types";
import { AppLink } from "@/components/ui/app-link";

vi.mock("@/components/journal/journal-entry-composer", () => ({
  JournalEntryComposer: () => null,
}));
vi.mock("@/components/ui/app-link", () => ({ AppLink: () => null }));
vi.mock("@/components/product-tours/profile-tour-previews", () => ({
  DemoAccount: () => null,
  DemoAnalytics: () => null,
  DemoJournal: () => null,
  DemoProjects: () => null,
  DemoSends: () => null,
}));

type NodeProps = { children?: ReactNode; onClick?: () => void; href?: string };
function elements(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function context(): ProductTourStepProps {
  return {
    userId: "real-owner",
    values: {},
    navigate: vi.fn<ProductTourStepProps["navigate"]>(),
    close: vi.fn<() => void>(),
  };
}

describe("profile tutorials", () => {
  it("opens every chooser card inside the tour instead of leaving for a profile", () => {
    const props = context();
    const buttons = elements(TourDestinations(props)).filter(
      (element) => element.type === "button",
    );
    expect(buttons).toHaveLength(5);
    for (const [index, button] of buttons.entries()) {
      button.props.onClick?.();
      expect(props.navigate).toHaveBeenLastCalledWith(profileTourSteps[index].id);
    }
    expect(props.close).not.toHaveBeenCalled();
  });

  it("links explicit exits to the viewer's real pages and supplies a return to the chooser", () => {
    const destinations = [
      "/users/real-owner/journal",
      "/users/real-owner/sends",
      "/users/real-owner/projects",
      "/users/real-owner/analytics",
      "/account",
    ];
    for (const [index, step] of profileTourSteps.entries()) {
      const props = context();
      const Content = step.Content as (
        props: ProductTourStepProps,
      ) => ReactElement<ProductTourStepProps>;
      const frame = Content(props);
      const Frame = frame.type as (props: ProductTourStepProps) => ReactElement;
      const nodes = elements(Frame(frame.props));
      const link = nodes.find((node) => node.type === AppLink);
      expect(link?.props.href).toBe(destinations[index]);
      link?.props.onClick?.();
      expect(props.close).toHaveBeenCalledOnce();
      const overview = nodes.find(
        (node) => node.props.children === "All tutorials",
      ) as ReactElement<{ onPress: () => void }>;
      overview.props.onPress();
      expect(props.navigate).toHaveBeenCalledWith("explore");
    }
  });
});

describe("real-entry tutorial branches", () => {
  it.each(["training", "project", "session", "ascent", "repeat"])(
    "offers the owner's Journal after saving %s",
    (outcome) => {
      const props = { ...context(), values: { outcome } };
      const Saved = journalTourSteps.find((step) => step.id === "saved")!.Content as (
        props: ProductTourStepProps,
      ) => ReactElement;
      const nodes = elements(Saved(props));
      const link = nodes.find((node) => node.type === AppLink);
      expect(link?.props.children).toBe("Open my Journal");
      expect(link?.props.href).toBe("/users/real-owner/journal");
      link?.props.onClick?.();
      expect(props.close).toHaveBeenCalledOnce();
      expect(props.navigate).not.toHaveBeenCalled();
      const demo = nodes.find(
        (node) => node.props.children === "Explore the tutorials",
      ) as ReactElement<{ onPress: () => void }>;
      demo.props.onPress();
      expect(props.navigate).toHaveBeenCalledWith("explore");
    },
  );

  it("names the real logging and demo branches before either opens", () => {
    const props = context();
    const Intro = journalTourSteps[0].Content as (props: ProductTourStepProps) => ReactElement;
    const nodes = elements(Intro(props));
    for (const [label, destination] of [
      ["Log my own entry", "compose"],
      ["Explore the demo", "explore"],
    ]) {
      const button = nodes.find((node) => node.props.children === label) as ReactElement<{
        onPress: () => void;
      }>;
      button.props.onPress();
      expect(props.navigate).toHaveBeenLastCalledWith(destination);
    }
  });
});
