import {
  Controller,
  Post,
  Body,
  HttpCode,
  UsePipes,
  ValidationPipe,
  Get,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 🎯 디버깅용 GET 엔드포인트 추가
  @Get('test')
  test(): { message: string } {
    return { message: 'Events controller is working!' };
  }

  @Post('track')
  @HttpCode(202) // 202 Accepted for async processing
  @UsePipes(new ValidationPipe({ transform: true }))
  async track(
    @Body() trackEventDto: TrackEventDto,
  ): Promise<{ status: string; message: string }> {
    // Process the event asynchronously (for now, synchronously in Phase 1)
    await this.eventsService.track(trackEventDto);

    return {
      status: 'accepted',
      message: 'Event has been accepted and will be processed.',
    };
  }

  @Get('names')
  async getEventNames(
    @Query('workspaceId') workspaceId: string,
  ): Promise<{ eventNames: string[] }> {
    const eventNames =
      await this.eventsService.getUniqueEventNames(workspaceId);
    return { eventNames };
  }
}
