import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Campaign } from '@prisma/client';

const mockPrismaService = {
  campaign: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  // We will mock the $transaction later if needed
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new campaign with DRAFT status', async () => {
      const createCampaignDto: CreateCampaignDto = {
        workspaceId: 'ws_test',
        name: 'Test Campaign',
        createdBy: 'test-user',
      };

      const expectedCampaign: Campaign = {
        id: 'some-uuid',
        ...createCampaignDto,
        status: 'DRAFT',
        description: null,
        priority: 'DEFAULT',
        canvasDefinition: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.campaign.create.mockResolvedValue(expectedCampaign);

      const result = await service.create(createCampaignDto);
      
      expect(mockPrismaService.campaign.create).toHaveBeenCalledWith({
        data: {
          ...createCampaignDto,
          status: 'DRAFT',
        },
      });
      expect(result).toEqual(expectedCampaign);
    });
  });

  describe('update', () => {
    it('should update a campaign', async () => {
      const campaignId = 'some-uuid';
      const updateCampaignDto = {
        name: 'Updated Campaign Name',
        canvasDefinition: { nodes: [{ id: 'node1' }] },
      };

      const expectedCampaign = {
        id: campaignId,
        workspaceId: 'ws_test',
        name: 'Updated Campaign Name',
        status: 'DRAFT',
        createdBy: 'test-user',
        canvasDefinition: { nodes: [{ id: 'node1' }] },
        description: null,
        priority: 'DEFAULT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.campaign.update.mockResolvedValue(expectedCampaign);

      const result = await service.update(campaignId, updateCampaignDto as any);

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: campaignId },
        data: updateCampaignDto,
      });
      expect(result).toEqual(expectedCampaign);
    });
  });

  describe('activate', () => {
    it('should find all active users and start the campaign for them if trigger is IMMEDIATE', async () => {
      const campaignId = 'campaign-to-activate';
      const workspaceId = 'ws_test';
      const mockCampaign = {
        id: campaignId,
        workspaceId,
        canvasDefinition: { // This should be Prisma.JsonValue, casting for test
          nodes: [{ id: 'trigger_node', type: 'IMMEDIATE', data: { targetAudience: 'ALL_USERS' } }],
          edges: [],
        } as any, 
      };
      const mockUsers = [
        { id: 'user1', distinctId: 'user1' },
        { id: 'user2', distinctId: 'user2' },
      ];

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      
      // This is a placeholder for the enrollment/queueing logic
      service.triggerCampaignForUsers = jest.fn();

      await service.activate(campaignId);

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({ where: { id: campaignId } });
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { workspaceId, emailStatus: 'active' },
      });
      expect(service.triggerCampaignForUsers).toHaveBeenCalledWith(mockCampaign, mockUsers);
    });

    it('should NOT start the campaign if trigger is not IMMEDIATE', async () => {
      const campaignId = 'campaign-with-event-trigger';
      const mockCampaign = {
        id: campaignId,
        canvasDefinition: {
          nodes: [{ id: 'trigger_node', type: 'EVENT_BASED', data: { eventName: 'SignUp' } }],
          edges: [],
        } as any,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      service.triggerCampaignForUsers = jest.fn();

      await service.activate(campaignId);

      expect(service.triggerCampaignForUsers).not.toHaveBeenCalled();
    });
  });
});
