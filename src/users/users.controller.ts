import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, BadRequestException, RawBodyRequest, UsePipes, ValidationPipe, NotFoundException, HttpCode, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as express from 'express';
import { AddUserPropertyDto } from './dto/add-user-property.dto';
import { IdentifyUserDto } from './dto/identify-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  upsertUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.upsert(createUserDto);
  }

  @Post('bulk')
  @HttpCode(202)
  bulkUpsertUsers(@Query('workspaceId') workspaceId: string, @Req() req: express.Request) {
    if (!req.is('text/csv')) {
      throw new BadRequestException('Content-Type must be text/csv');
    }
    // With custom express.raw middleware, the body is in req.body as a Buffer
    if (!req.body || !(req.body instanceof Buffer)) {
      throw new BadRequestException('Raw body is missing for csv upload.');
    }
    
    const csvContent = req.body.toString('utf8');
    // We are not awaiting this intentionally to return 202 immediately
    this.usersService.bulkUpsertFromCsv(workspaceId, csvContent);

    return { status: 'processing', message: 'User import job has been queued.' };
  }

  @Get()
  findAll(
    @Query('workspaceId') workspaceId: string,
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe({ errorHttpStatusCode: 400 })) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    // Clamp the limit to a max of 100
    const take = Math.min(limit, 100);
    return this.usersService.findAll(workspaceId, take, cursor);
  }

  // 🎯 IMPORTANT: This endpoint must be BEFORE @Get(':id') to avoid routing conflicts
  @Get('properties')
  async getUniqueProperties(@Query('workspaceId') workspaceId: string) {
    const properties = await this.usersService.getUniqueProperties(workspaceId);
    return { properties };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('workspaceId') workspaceId: string) {
    // For now, event pagination is not implemented in the controller
    return this.usersService.findOneById(workspaceId, id, 30, undefined);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/properties')
  addProperty(@Param('id') id: string, @Body() addUserPropertyDto: AddUserPropertyDto) {
    return this.usersService.addProperty(id, addUserPropertyDto);
  }

  @Post('identify')
  @UsePipes(new ValidationPipe({ transform: true }))
  identify(@Body() identifyUserDto: IdentifyUserDto) {
    return this.usersService.identify(identifyUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
