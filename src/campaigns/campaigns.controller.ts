import { Controller, Post, Body, Query, HttpCode, Patch, Param, Get } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { SendCampaignDto } from './dto/send-campaign.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query('workspaceId') workspaceId: string) {
    return this.campaignsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Post()
  create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignsService.create(createCampaignDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCampaignDto: UpdateCampaignDto) {
    if (updateCampaignDto.status === 'ACTIVE') {
      return this.campaignsService.activate(id);
    }
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Post('send')
  @HttpCode(202)
  sendCampaign(
    @Query('workspaceId') workspaceId: string,
    @Body() sendCampaignDto: SendCampaignDto,
  ) {
    // We are not awaiting this intentionally to return 202 immediately
    this.campaignsService.sendManualCampaign(workspaceId, sendCampaignDto);

    return { status: 'processing', message: 'Campaign sending job has been queued.' };
  }
}
