import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { Liquid } from 'liquidjs';
import { marked } from 'marked';
import { Prisma, TemplateContentType } from '@prisma/client';

const engine = new Liquid();

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async preview(previewTemplateDto: PreviewTemplateDto) {
    const { userId, contentType, content } = previewTemplateDto;
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // 🎯 Create flattened scope for easier variable access
    // This allows {{user.name}} instead of {{user.properties.name}}
    const userProperties = (user.properties || {}) as Record<string, any>;
    const scope = {
      user: {
        id: user.id,
        distinctId: user.distinctId,
        emailStatus: user.emailStatus,
        // Flatten properties for direct access
        name: userProperties.name || 'User',
        email: userProperties.email || '',
        ...userProperties, // Include all other properties
      }
    };

    const renderedSubject = await engine.parseAndRender(content.subject, scope);
    let renderedContent: string;

    const bodyContent = (content as any).body || '';
    const parsedBody = await engine.parseAndRender(bodyContent, scope);

    if (contentType === TemplateContentType.MARKDOWN) {
      renderedContent = await marked(parsedBody);
    } else {
      renderedContent = parsedBody;
    }

    return { renderedSubject, renderedContent };
  }

  create(createTemplateDto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        ...createTemplateDto,
        content: createTemplateDto.content as unknown as Prisma.JsonObject,
      },
    });
  }

  findAll(workspaceId: string) {
    return this.prisma.template.findMany({
      where: { workspaceId },
    });
  }

  findOne(id: string) {
    return this.prisma.template.findUnique({
      where: { id },
    });
  }

  update(id: string, updateTemplateDto: UpdateTemplateDto) {
    const { content, ...rest } = updateTemplateDto;
    const data: Prisma.TemplateUpdateInput = rest;
    if (content) {
      data.content = content as unknown as Prisma.JsonObject;
    }
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.template.delete({
      where: { id },
    });
  }
}
