import {
    BranchResponse,
    CreateBranch,
} from '../interfaces/branches.interfaces';

export const createBranchUseCase = async (
  params: CreateBranch,
): Promise<BranchResponse> => {
  const { dto, repository, translationService, restaurantId, lang } = params;

  const newBranch = repository.create({
    ...dto,
    restaurant: { id: restaurantId },
  });

  await repository.save(newBranch);

  return {
    branch: newBranch,
    message: translationService.translate('branches.branch_created', lang),
  };
};
