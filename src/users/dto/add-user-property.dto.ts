import { IsNotEmpty, IsString } from 'class-validator';

export class AddUserPropertyDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: any;
}
