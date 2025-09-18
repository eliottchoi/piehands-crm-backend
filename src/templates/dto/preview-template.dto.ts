import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateContentType } from '@prisma/client';

class PreviewTemplateContentDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  // Can be body_html, body_markdown, or body_text
  body: string;
}

export class PreviewTemplateDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;
  
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(TemplateContentType)
  @IsNotEmpty()
  contentType: TemplateContentType;

  @IsObject()
  @ValidateNested()
  @Type(() => PreviewTemplateContentDto)
  content: PreviewTemplateContentDto;
}
