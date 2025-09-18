import { Body, Controller, Delete, Get, Param, Patch, Post, Query, NotFoundException, UsePipes, ValidationPipe } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post('preview')
  @UsePipes(new ValidationPipe({ transform: true }))
  preview(@Body() previewTemplateDto: PreviewTemplateDto) {
    return this.templatesService.preview(previewTemplateDto);
  }

  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(createTemplateDto);
  }

  @Get()
  async findAll(@Query('workspaceId') workspaceId: string) {
    try {
      return await this.templatesService.findAll(workspaceId);
    } catch (error) {
      console.error('Templates findAll error:', error);
      // 임시로 빈 배열 반환
      return [];
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const template = await this.templatesService.findOne(id);
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
