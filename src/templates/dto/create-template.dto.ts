import { IsString, IsNotEmpty, IsIn, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateType } from '@prisma/client';

class EmailContentDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body_html: string;
}

class SmsContentDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn([TemplateType.EMAIL, TemplateType.SMS])
  type: TemplateType;

  @IsObject()
  @ValidateNested()
  @Type((value) => {
    if (!value || !value.object) return Object;
    if (value.object.type === TemplateType.EMAIL) {
      return EmailContentDto;
    } else if (value.object.type === TemplateType.SMS) {
      return SmsContentDto;
    }
    return Object;
  })
  content: EmailContentDto | SmsContentDto;
  
  // This will be populated from the authenticated user later
  @IsString()
  @IsNotEmpty()
  createdBy: string; 
}
