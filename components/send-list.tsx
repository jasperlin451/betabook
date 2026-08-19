"use client";

import { Chip, Link, Table } from "@heroui/react";
import { formatGrade, type ClimbType } from "@/lib/grades";
import type { CompletionType } from "@/lib/sends";
import type { SendWithClimb, SendWithUserName } from "@/db/queries";

const COMPLETION_CHIP_COLOR: Record<CompletionType, "success" | "accent" | "warning"> = {
  onsight: "success",
  flash: "accent",
  redpoint: "warning",
};

type SendListProps =
  | { context: "climb"; sends: SendWithUserName[]; climbType: ClimbType }
  | { context: "user"; sends: SendWithClimb[] };

export function SendList(props: SendListProps) {
  if (props.sends.length === 0) {
    return <p className="text-muted text-sm">No sends yet.</p>;
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Sends">
          <Table.Header>
            <Table.Column isRowHeader>
              {props.context === "climb" ? "Sender" : "Climb"}
            </Table.Column>
            <Table.Column>Date</Table.Column>
            <Table.Column>Type</Table.Column>
            <Table.Column>Grade</Table.Column>
            <Table.Column>Rating</Table.Column>
            <Table.Column>Comment</Table.Column>
          </Table.Header>
          <Table.Body>
            {props.context === "climb"
              ? props.sends.map((send) => (
                  <Table.Row key={send.id} id={send.id}>
                    <Table.Cell>
                      <Link href={`/users/${send.userId}`}>{send.userName}</Link>
                    </Table.Cell>
                    <Table.Cell>{send.dateSent ?? "Date unknown"}</Table.Cell>
                    <Table.Cell>
                      <Chip color={COMPLETION_CHIP_COLOR[send.completionType]} variant="primary">
                        {send.completionType.toUpperCase()}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{formatGrade(props.climbType, send.suggestedGrade)}</Table.Cell>
                    <Table.Cell>{send.rating != null ? `${send.rating}/5` : "No rating"}</Table.Cell>
                    <Table.Cell>{send.comment ?? "—"}</Table.Cell>
                  </Table.Row>
                ))
              : props.sends.map((send) => (
                  <Table.Row key={send.id} id={send.id}>
                    <Table.Cell>
                      <Link href={`/climbs/${send.climbId}`}>{send.climbName}</Link>
                    </Table.Cell>
                    <Table.Cell>{send.dateSent ?? "Date unknown"}</Table.Cell>
                    <Table.Cell>
                      <Chip color={COMPLETION_CHIP_COLOR[send.completionType]} variant="primary">
                        {send.completionType.toUpperCase()}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{formatGrade(send.climbType, send.suggestedGrade)}</Table.Cell>
                    <Table.Cell>{send.rating != null ? `${send.rating}/5` : "No rating"}</Table.Cell>
                    <Table.Cell>{send.comment ?? "—"}</Table.Cell>
                  </Table.Row>
                ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
