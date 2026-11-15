"use client";

import { BlockBoundary } from "./block_frame";
import { BoardBlock } from "./board_block";
import { CalendarBlock } from "./calendar_block";
import { CardsBlock } from "./cards_block";
import { ChartBlock } from "./chart_block";
import { ButtonsBlock, DividerBlock, ImageBlock, TextBlock } from "./content_blocks";
import { CustomBlock } from "./custom_block";
import { FormBlock } from "./form_block";
import { PassBlock } from "./pass_block";
import { PlacementBlock } from "./placement_block";
import { ScannerBlock } from "./scanner_block";
import { ScheduleBlock } from "./schedule_block";
import { TimelineBlock } from "./timeline_block";
import { RecordBlock } from "./record_block";
import { StatsBlock } from "./stats_block";
import { TableBlock } from "./table_block";

const BLOCKS = {
  table: TableBlock, cards: CardsBlock, board: BoardBlock, calendar: CalendarBlock, record: RecordBlock, form: FormBlock,
  stats: StatsBlock, chart: ChartBlock, text: TextBlock, image: ImageBlock, buttons: ButtonsBlock, divider: DividerBlock,
  schedule: ScheduleBlock, timeline: TimelineBlock, placement: PlacementBlock, scanner: ScannerBlock, pass: PassBlock, custom: CustomBlock,
};

// One block of a page. `fill` makes it take its whole cell on a canvas page.
export function BlockView({ block, fill = false }) {
  const Block = BLOCKS[block.kind];
  if (!Block) return null;
  return <BlockBoundary><Block block={block} fill={fill} /></BlockBoundary>;
}
